from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from sqlalchemy import func, text, inspect as sa_inspect
from database import engine, Base, get_db
import models, schemas, crud, auth
from deps import get_current_user, get_current_admin
from ratelimit import limiter
from routers import groups, classic, survival, admin
import stripe
import os
import asyncio
import httpx
import json
from datetime import datetime, timedelta, timezone
from services import football_api as fb_api
from services.live_updater import start_live_updater_loop
from services.scoring import calculate_user_score
from recalc import run_recalc

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
INSCRIPTION_PRICE_CENTS = int(os.getenv("INSCRIPTION_PRICE_CENTS", 1000))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ALLOWED_ORIGINS: lista separada por comas en la variable de entorno.
# Prod (Railway): establecer el dominio real de Vercel, ej:
#   ALLOWED_ORIGINS=https://quiniela-frontend.vercel.app,https://smrquinielas.com
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",")]

# COOKIE_SECURE: true en producción (HTTPS), false en dev local (HTTP)
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

# Esquema gestionado por Alembic — ejecuta `alembic upgrade head` antes de arrancar
# Base.metadata.create_all(bind=engine)  ← solo para tests unitarios sin Alembic

app = FastAPI(title="Quiniela API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(groups.router)
app.include_router(classic.router)
app.include_router(survival.router)
app.include_router(admin.router)


@app.on_event("startup")
async def _startup():
    """Migración segura + Árbitro Automático."""
    # Auto-migración: añade group_name si la columna aún no existe.
    # Funciona en SQLite (local) y PostgreSQL (Railway) — el except absorbe
    # el error de "columna duplicada" si ya se ejecutó antes.
    try:
        inspector = sa_inspect(engine)
        existing_cols = [c["name"] for c in inspector.get_columns("matches")]
        if "group_name" not in existing_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE matches ADD COLUMN group_name VARCHAR"))
                conn.commit()
    except Exception:
        pass

    asyncio.create_task(start_live_updater_loop())


@app.get("/")
def read_root():
    return {"message": "API de la Quiniela Mundialista activa"}

@app.post("/users/", response_model=schemas.UserResponse)
@limiter.limit("10/minute")
def create_user(request: Request, user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    return crud.create_user(db=db, user=user)

@app.post("/login")
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user.login_count = (user.login_count or 0) + 1
    user.last_active = datetime.utcnow()
    db.commit()
    access_token = auth.create_access_token(data={"sub": user.email})
    response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    # SameSite=None es necesario en producción porque frontend (Vercel) y
    # backend (Railway) son sitios distintos — Lax bloquea los XHR cross-site.
    # En local (COOKIE_SECURE=False) usamos Lax para no requerir HTTPS.
    cookie_samesite = "none" if COOKIE_SECURE else "lax"
    response.set_cookie(
        key="token",
        value=access_token,
        max_age=86400,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=cookie_samesite,
        path="/",
    )
    return response

@app.post("/logout")
def logout():
    cookie_samesite = "none" if COOKIE_SECURE else "lax"
    response = JSONResponse(content={"status": "ok"})
    response.delete_cookie(key="token", path="/", httponly=True, secure=COOKIE_SECURE, samesite=cookie_samesite)
    return response

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.patch("/users/me/favorites", response_model=schemas.UserResponse)
def update_favorite_teams(
    data: schemas.FavoriteTeamsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if len(data.teams) > 3:
        raise HTTPException(status_code=400, detail="Máximo 3 equipos favoritos.")
    import json as _json
    current_user.favorite_teams = _json.dumps(data.teams)
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/payments/create-checkout-session", response_model=schemas.CheckoutSessionResponse)
@limiter.limit("10/minute")
def create_checkout_session(
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_paid:
        raise HTTPException(status_code=400, detail="Ya estás inscrito en la quiniela")
    if not stripe.api_key or stripe.api_key == "sk_test_REPLACE_ME":
        raise HTTPException(status_code=503, detail="Pasarela de pago no configurada")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "eur",
                "product_data": {"name": "Inscripción Quiniela"},
                "unit_amount": INSCRIPTION_PRICE_CENTS,
            },
            "quantity": 1,
        }],
        mode="payment",
        customer_email=current_user.email,
        metadata={"user_id": current_user.id},
        success_url=f"{FRONTEND_URL}/payment-success",
        cancel_url=f"{FRONTEND_URL}/payment-cancel",
    )

    crud.create_payment_record(
        db,
        user_id=current_user.id,
        stripe_session_id=session.id,
        amount=INSCRIPTION_PRICE_CENTS / 100,
    )
    return {"checkout_url": session.url}


@app.post("/payments/webhook", status_code=200)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Payload inválido")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Firma del webhook inválida")

    if event["type"] == "checkout.session.completed":
        stripe_session = event["data"]["object"]
        crud.confirm_payment(db, stripe_session_id=stripe_session["id"])

    return {"status": "ok"}


class ActivatePlanRequest(BaseModel):
    user_id: int
    plan: str  # "classic" | "survival" | "complete"

@app.post("/payments/activate-plan", response_model=schemas.UserResponse)
def activate_plan(
    body: ActivatePlanRequest,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin),
):
    """Activa los flags de acceso por plan para un usuario específico.
    Solo ejecutable por administradores — en producción se llama desde el webhook de Stripe."""
    if body.plan not in ("classic", "survival", "complete"):
        raise HTTPException(status_code=400, detail="Plan inválido. Usa: classic, survival, complete")

    target = db.query(models.User).filter(models.User.id == body.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if body.plan in ("classic", "complete"):
        target.has_paid_classic = True
    if body.plan in ("survival", "complete"):
        target.has_paid_survival = True
    db.commit()
    db.refresh(target)
    return target

@app.post("/matches/", response_model=schemas.MatchResponse)
def create_match(
    match: schemas.MatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    return crud.create_match(db=db, match=match)

@app.post("/predictions/", response_model=schemas.PredictionResponse)
def create_prediction(
    prediction: schemas.PredictionCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.has_paid_classic:
        raise HTTPException(status_code=403, detail="Necesitas el Modo Clásico para hacer predicciones")
    match = db.query(models.Match).filter(models.Match.id == prediction.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    if datetime.utcnow() >= match.kickoff_time - timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="El tiempo para predecir este partido ha expirado")
    return crud.create_prediction(db=db, prediction=prediction, user_id=current_user.id)

@app.post("/matches/{match_id}/finish", response_model=schemas.MatchResponse)
def finish_match(
    match_id: int,
    result: schemas.MatchResultCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    match = crud.finish_match_and_calculate_points(
        db=db,
        match_id=match_id,
        home_score=result.home_score,
        away_score=result.away_score,
        winning_team=result.winning_team,
    )
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    return match

@app.post("/admin/sync-fixtures")
async def sync_fixtures(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin),
):
    """
    Descarga el calendario oficial del Mundial 2026 (liga 15, temporada 2026)
    desde API-Football y hace upsert en la BD: crea los partidos que faltan
    y actualiza fecha/ronda/estado/marcador de los que ya existen.

    Los nombres de equipo se guardan tal como los devuelve la API (en inglés,
    ej. "Mexico", "Spain") para que el Árbitro Automático (live_updater) pueda
    encontrarlos por nombre sin ambigüedad.
    """
    headers = {
        "x-apisports-key": os.getenv("API_FOOTBALL_KEY"),
        "x-apisports-host": "v3.football.api-sports.io",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            fixtures_resp, standings_resp = await asyncio.gather(
                client.get(
                    "https://v3.football.api-sports.io/fixtures",
                    headers=headers,
                    params={"league": 1, "season": 2026},
                ),
                client.get(
                    "https://v3.football.api-sports.io/standings",
                    headers=headers,
                    params={"league": 1, "season": 2026},
                ),
                return_exceptions=True,
            )
        fixtures_resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Error al contactar API-Football: {e}")

    # Build team → form map AND team → group letter from standings.
    # Ambos son no-críticos (standings puede estar vacío antes del torneo).
    form_map: dict[str, str] = {}
    group_map: dict[str, str] = {}
    try:
        for league_entry in standings_resp.json().get("response", []):
            for group in league_entry.get("league", {}).get("standings", []):
                for entry in group:
                    name = entry["team"]["name"]
                    form = entry.get("form") or ""
                    if name and form:
                        form_map[name] = form
                    # entry["group"] = "Group A", "Group B", … → extraemos solo la letra
                    raw_group = entry.get("group", "")
                    letter = raw_group.replace("Group ", "").strip()
                    if name and letter and len(letter) == 1 and letter.isalpha():
                        group_map[name] = letter.upper()
    except Exception:
        pass  # standings is cosmetic — never fail the sync because of it

    fixtures = fixtures_resp.json().get("response", [])
    created = 0
    updated = 0

    for fx in fixtures:
        api_id       = fx["fixture"]["id"]
        kickoff_raw  = fx["fixture"]["date"]
        venue_name   = fx["fixture"]["venue"]["name"]
        round_name   = fx["league"]["round"]
        status_short = fx["fixture"]["status"]["short"]
        home_name    = fx["teams"]["home"]["name"]
        away_name    = fx["teams"]["away"]["name"]

        kickoff = (
            datetime.fromisoformat(kickoff_raw.replace("Z", "+00:00"))
            .astimezone(timezone.utc)
            .replace(tzinfo=None)
        )

        match = db.query(models.Match).filter(models.Match.api_match_id == api_id).first()
        if not match:
            match = (
                db.query(models.Match)
                .filter(
                    func.lower(models.Match.home_team) == home_name.strip().lower(),
                    func.lower(models.Match.away_team) == away_name.strip().lower(),
                )
                .first()
            )

        # Ambos equipos de un partido de fase de grupos comparten el mismo grupo
        match_group = group_map.get(home_name) or group_map.get(away_name)

        if match:
            match.api_match_id = api_id
            match.home_team    = home_name
            match.away_team    = away_name
            match.kickoff_time = kickoff
            match.round        = round_name
            match.venue        = venue_name
            match.status       = status_short
            if match_group:
                match.group_name = match_group
            if home_name in form_map:
                match.home_form = form_map[home_name]
            if away_name in form_map:
                match.away_form = form_map[away_name]
            updated += 1
        else:
            db.add(models.Match(
                api_match_id=api_id,
                home_team=home_name,
                away_team=away_name,
                kickoff_time=kickoff,
                round=round_name,
                venue=venue_name,
                status=status_short,
                group_name=match_group,
                home_form=form_map.get(home_name),
                away_form=form_map.get(away_name),
            ))
            created += 1

    db.commit()
    return {
        "total_from_api": len(fixtures),
        "created": created,
        "updated": updated,
        "teams_with_form": len(form_map),
    }


@app.post("/admin/sync-results")
def sync_results(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Descarga los partidos finalizados de API-Football.
    Por cada partido que en nuestra BD aún no esté marcado como FT,
    dispara finish_match_and_calculate_points y actualiza el leaderboard.
    """
    try:
        fixtures = fb_api.get_finished_fixtures()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al contactar API-Football: {e}")

    updated = 0
    for fixture in fixtures:
        parsed = fb_api.parse_fixture(fixture)

        if parsed["home_score"] is None or parsed["away_score"] is None:
            continue

        match = crud.get_match_by_api_id(db, parsed["api_match_id"])
        if not match or match.status == "FT":
            continue  # no existe en nuestra BD o ya procesado

        crud.finish_match_and_calculate_points(
            db,
            match_id=match.id,
            home_score=parsed["home_score"],
            away_score=parsed["away_score"],
        )
        updated += 1

    return {"checked": len(fixtures), "updated": updated}


@app.get("/matches/all", response_model=list[schemas.MatchResponse])
def list_all_matches(db: Session = Depends(get_db)):
    return db.query(models.Match).order_by(models.Match.kickoff_time).all()

_LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"}

@app.get("/matches/live", response_model=list[schemas.MatchResponse])
def list_live_matches(db: Session = Depends(get_db)):
    matches = db.query(models.Match).all()
    return [m for m in matches if m.status in _LIVE_STATUSES]

@app.get("/matches/today", response_model=list[schemas.MatchResponse])
def list_today_matches(db: Session = Depends(get_db)):
    """Partidos de hoy (UTC) más cualquier partido actualmente en vivo."""
    from datetime import date
    today_start = datetime.combine(date.today(), datetime.min.time())
    tomorrow_start = today_start + timedelta(days=1)

    all_matches = db.query(models.Match).order_by(models.Match.kickoff_time).all()
    result = []
    for m in all_matches:
        is_today = today_start <= m.kickoff_time < tomorrow_start
        is_live_now = m.status in _LIVE_STATUSES
        if is_today or is_live_now:
            result.append(m)
    return result

@app.post("/admin/sync-live")
def sync_live(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Descarga partidos en curso y actualiza su status/minuto/marcador en la BD."""
    from services import football_api as fb_api
    try:
        live_statuses = "-".join(_LIVE_STATUSES)
        fixtures = fb_api.get_fixtures(live_statuses)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al contactar API-Football: {e}")

    updated = 0
    for fixture in fixtures:
        parsed = fb_api.parse_fixture(fixture)
        match = crud.get_match_by_api_id(db, parsed["api_match_id"])
        if match and match.status != "FT":
            crud.update_live_match(db, match, parsed)
            updated += 1

    return {"live_from_api": len(fixtures), "updated": updated}

@app.get("/matches/", response_model=list[schemas.MatchResponse])
def list_matches(db: Session = Depends(get_db)):
    return (
        db.query(models.Match)
        .filter(models.Match.status != "FT")
        .order_by(models.Match.kickoff_time)
        .all()
    )

@app.get("/leaderboard", response_model=list[schemas.LeaderboardEntry])
def get_leaderboard(db: Session = Depends(get_db)):
    return db.query(models.Leaderboard).order_by(models.Leaderboard.rank_position).all()

@app.get("/leaderboard/global", response_model=list[schemas.GlobalLeaderboardEntry])
def global_leaderboard(db: Session = Depends(get_db)):
    """Calcula los puntos en vivo cruzando los pronósticos de cada usuario con los
    marcadores actuales de la BD, incluyendo partidos en curso (LIVE/HT/1H/2H/ET/etc)."""
    matches_with_score = (
        db.query(models.Match)
        .filter(models.Match.home_score.isnot(None), models.Match.away_score.isnot(None))
        .all()
    )
    real_group_results = [
        {"homeTeam": m.home_team, "awayTeam": m.away_team, "homeScore": m.home_score, "awayScore": m.away_score}
        for m in matches_with_score
    ]
    match_by_teams = {
        f"{m.home_team.strip().lower()}|{m.away_team.strip().lower()}": m
        for m in matches_with_score
    }

    users = db.query(models.User).all()
    raw = []
    for user in users:
        record = db.query(models.ClassicPrediction).filter(
            models.ClassicPrediction.user_id == user.id
        ).first()

        if not record:
            raw.append({
                "user": user, "total_points": 0,
                "exact_matches_count": 0, "diff_matches_count": 0, "tendency_matches_count": 0,
            })
            continue

        group_fixtures   = json.loads(record.group_fixtures)
        knockout_scores  = json.loads(record.knockout_scores)
        captain_matches  = json.loads(record.captain_matches or "[]")
        bracket_snapshot = json.loads(record.bracket_snapshot or "{}")

        real_knockout_results = {}
        for slot_id, teams in bracket_snapshot.items():
            key = f"{teams['home'].strip().lower()}|{teams['away'].strip().lower()}"
            m = match_by_teams.get(key)
            if m:
                real_knockout_results[slot_id] = {"homeScore": m.home_score, "awayScore": m.away_score}

        result = calculate_user_score(
            group_fixtures=group_fixtures,
            knockout_scores=knockout_scores,
            captain_matches=captain_matches,
            real_group_results=real_group_results,
            real_knockout_results=real_knockout_results,
            predicted_champion=None,
            real_champion=None,
        )

        raw.append({
            "user": user,
            "total_points":          result["total_points"],
            "exact_matches_count":   result["exact_count"],
            "diff_matches_count":    result["difference_count"],
            "tendency_matches_count": result["tendency_count"],
        })

    # Desempate: pts DESC → exactos DESC → fecha de registro ASC (cuenta más antigua gana)
    raw.sort(key=lambda x: (
        -x["total_points"],
        -x["exact_matches_count"],
        x["user"].created_at or datetime.min,
    ))
    return [
        schemas.GlobalLeaderboardEntry(
            rank=i + 1,
            user=schemas.LeaderboardUserInfo(id=e["user"].id, email=e["user"].email, name=e["user"].name),
            total_points=e["total_points"],
            exact_matches_count=e["exact_matches_count"],
            diff_matches_count=e["diff_matches_count"],
            tendency_matches_count=e["tendency_matches_count"],
        )
        for i, e in enumerate(raw)
    ]

@app.get("/survivors/global", response_model=list[schemas.GlobalSurvivorEntry])
def global_survivors(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    entries = []
    for user in users:
        last_pick = (
            db.query(models.SurvivorPick)
            .filter(models.SurvivorPick.user_id == user.id)
            .order_by(models.SurvivorPick.created_at.desc())
            .first()
        )
        is_eliminated = (
            db.query(models.SurvivorPick)
            .filter(
                models.SurvivorPick.user_id == user.id,
                models.SurvivorPick.is_correct == False,
            )
            .first()
        ) is not None
        entries.append(schemas.GlobalSurvivorEntry(
            user=schemas.LeaderboardUserInfo(id=user.id, email=user.email, name=user.name),
            is_alive=not is_eliminated,
            last_team_picked=last_pick.team_id if last_pick else None,
        ))
    entries.sort(key=lambda x: (not x.is_alive,))
    return entries

# --- NUEVA RUTA: VER MIS PREDICCIONES Y PUNTOS ---
@app.get("/predictions/me", response_model=list[schemas.PredictionResponse])
def get_my_predictions(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Prediction).filter(models.Prediction.user_id == current_user.id).all()

@app.get("/predictions/me/detail", response_model=list[schemas.PredictionDetail])
def get_my_predictions_detail(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    preds = db.query(models.Prediction).filter(models.Prediction.user_id == current_user.id).all()
    results = []
    for p in preds:
        match = db.query(models.Match).filter(models.Match.id == p.match_id).first()
        results.append(schemas.PredictionDetail(
            id=p.id,
            match_id=p.match_id,
            predicted_home=p.predicted_home,
            predicted_away=p.predicted_away,
            points_earned=p.points_earned,
            match=match,
        ))
    return results

@app.get("/users/me/stats", response_model=schemas.UserStats)
def get_my_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    preds = db.query(models.Prediction).filter(models.Prediction.user_id == current_user.id).all()
    finished = [
        p for p in preds
        if db.query(models.Match).filter(models.Match.id == p.match_id, models.Match.status == "FT").first()
    ]
    # Escala oficial 5/3/2/1/0 — exacto = 5 pts, cualquier otro acierto > 0
    # cuenta como "tendencia" (3, 2 o 1 pts).
    exact = sum(1 for p in finished if p.points_earned == 5)
    tendency = sum(1 for p in finished if 0 < p.points_earned < 5)
    effectiveness = round((exact + tendency) / len(finished) * 100, 1) if finished else 0.0

    lb = db.query(models.Leaderboard).filter(models.Leaderboard.user_id == current_user.id).first()
    total_points = lb.total_points if lb else 0

    all_users = db.query(models.User).all()
    scores = []
    for u in all_users:
        ulb = db.query(models.Leaderboard).filter(models.Leaderboard.user_id == u.id).first()
        scores.append((u.id, ulb.total_points if ulb else 0))
    scores.sort(key=lambda x: x[1], reverse=True)
    rank = next((i + 1 for i, (uid, _) in enumerate(scores) if uid == current_user.id), len(scores))

    return schemas.UserStats(
        total_points=total_points,
        rank=rank,
        total_predictions=len(preds),
        finished_predictions=len(finished),
        exact_count=exact,
        tendency_count=tendency,
        effectiveness=effectiveness
    )

# --- NUEVA RUTA: BOTÓN DE PÁNICO PARA RECÁLCULO ---
@app.get("/admin/force-recalc")
def force_recalc_endpoint():
    try:
        run_recalc()
        return {"status": "success", "message": "Puntos recalculados en la base de datos de producción."}
    except Exception as e:
        return {"status": "error", "message": str(e)}