from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import engine, get_db
import models, schemas, crud, auth
from deps import get_current_user, get_current_admin, get_optional_user
from ratelimit import limiter
from routers import groups, classic, survival, admin
import stripe
import os
import asyncio
import httpx
import json
from typing import Optional
from datetime import datetime, timedelta, timezone
from services import football_api as fb_api
from services.live_updater import start_live_updater_loop
from services.scoring import (
    calculate_user_score, compute_live_classic_score, normalize_team_name, TEAM_TRANSLATIONS,
    compute_award_and_champion_bonus,
)
from recalc import run_recalc

# Configuración
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
INSCRIPTION_PRICE_CENTS = int(os.getenv("INSCRIPTION_PRICE_CENTS", 1000))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",")]
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

app = FastAPI(title="Quiniela API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Routers
app.include_router(groups.router)
app.include_router(classic.router)
app.include_router(survival.router)
app.include_router(admin.router)

@app.on_event("startup")
async def _startup():
    # Eliminamos la migración automática conflictiva que causaba el fallo en Railway
    asyncio.create_task(start_live_updater_loop())

@app.get("/")
def read_root():
    return {"message": "API de la Quiniela Mundialista activa"}

# --- RUTAS DE LÓGICA ---
@app.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    return crud.create_user(db=db, user=user)

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    user.last_active = datetime.utcnow()
    user.login_count = (user.login_count or 0) + 1
    db.commit()
    access_token = auth.create_access_token(data={"sub": user.email})
    response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    response.set_cookie(key="token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite="none" if COOKIE_SECURE else "lax")
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
    current_user.favorite_teams = json.dumps(data.teams)
    db.commit()
    db.refresh(current_user)
    return current_user


# Mapa inverso: nombre en español normalizado → conjunto de nombres en inglés normalizados.
# Permite encontrar predicciones aunque el nombre guardado en el fixture sea en español
# y el nombre en la BD sea en inglés (o una variante distinta).
_REVERSE_TEAM_MAP: dict[str, set[str]] = {}
for _eng, _esp in TEAM_TRANSLATIONS.items():
    _REVERSE_TEAM_MAP.setdefault(normalize_team_name(_esp), set()).add(normalize_team_name(_eng))

_FINISHED_MATCH_STATUSES = {"FT", "AET", "PEN"}
_LIVE_MATCH_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP", "IN_PLAY", "PAUSED"}


def _build_match_lookup(db: Session, include_live: bool = True) -> dict[str, dict]:
    """Mapea partidos por str(api_match_id) para cálculo de puntos inmune a nombres de equipos."""
    matches = db.query(models.Match).all()
    lookup: dict[str, dict] = {}

    valid_statuses = _FINISHED_MATCH_STATUSES | _LIVE_MATCH_STATUSES if include_live else set(_FINISHED_MATCH_STATUSES)

    for m in matches:
        if m.api_match_id is None:
            continue
        if m.status in valid_statuses and m.home_score is not None and m.away_score is not None:
            home_es = TEAM_TRANSLATIONS.get(m.home_team, m.home_team)
            away_es = TEAM_TRANSLATIONS.get(m.away_team, m.away_team)
            lookup[str(m.api_match_id)] = {
                "home_score": m.home_score,
                "away_score": m.away_score,
                "status": m.status or "FT",
                "home_team": normalize_team_name(home_es),
                "away_team": normalize_team_name(away_es),
                "round": m.round or "",  # necesario para detectar la fase en scoring.py
            }

    return lookup


def _find_final_slot(match_by_teams: dict[str, dict]) -> Optional[str]:
    """Ubica el slot de la Final (no confundir con Semifinales/3er lugar)."""
    from services.scoring import round_str_to_phase
    for slot_id, entry in match_by_teams.items():
        if round_str_to_phase(entry.get("round", "")) == "final":
            return slot_id
    return None


def _derive_predicted_champion(knockout_scores: dict, final_slot_id: Optional[str], match_by_teams: dict[str, dict]) -> Optional[str]:
    """Deriva el campeón que predijo el usuario a partir de su pick para la Final."""
    if not final_slot_id:
        return None
    final_match = match_by_teams.get(final_slot_id)
    pred = knockout_scores.get(final_slot_id)
    if not final_match or not pred:
        return None

    ph, pa = pred.get("homeScore"), pred.get("awayScore")
    if ph is None or pa is None:
        return None

    if ph > pa:
        return final_match["home_team"]
    if pa > ph:
        return final_match["away_team"]
    penalty_winner = pred.get("penaltyWinner")
    if penalty_winner == "home":
        return final_match["home_team"]
    if penalty_winner == "away":
        return final_match["away_team"]
    return None


def _compute_all_user_totals(db: Session, include_live: bool = True) -> list[tuple[models.User, dict]]:
    """Calcula en vivo los puntos de cada usuario cruzando su ClassicPrediction con Match."""
    match_by_teams = _build_match_lookup(db, include_live=include_live)
    final_slot_id = _find_final_slot(match_by_teams)
    records = {r.user_id: r for r in db.query(models.ClassicPrediction).all()}

    empty = {"total_points": 0, "exact_count": 0, "diff_count": 0, "tendency_count": 0,
             "total_predictions": 0, "finished_predictions": 0}

    totals = []
    for user in db.query(models.User).all():
        record = records.get(user.id)
        if record:
            knockout_scores = json.loads(record.knockout_scores or "{}")
            result = compute_live_classic_score(
                group_fixtures=json.loads(record.group_fixtures or "[]"),
                knockout_scores=knockout_scores,
                bracket_snapshot=json.loads(record.bracket_snapshot or "{}"),
                match_by_teams=match_by_teams,
            )
            predicted_champion = _derive_predicted_champion(knockout_scores, final_slot_id, match_by_teams)
            bonuses = compute_award_and_champion_bonus(
                top_scorer=record.top_scorer,
                top_assist=record.top_assist,
                best_young_player=record.best_young_player,
                predicted_champion=predicted_champion,
            )
            result["total_points"] += bonuses["total_bonus"]
            result["bonus_breakdown"] = bonuses
        else:
            result = dict(empty)
        totals.append((user, result))
    return totals


ADMIN_EMAIL = "santimagana@yahoo.com.mx"
_ONLINE_WINDOW = timedelta(minutes=5)

@app.get("/leaderboard/global", response_model=list[schemas.GlobalLeaderboardEntry])
def global_leaderboard(db: Session = Depends(get_db), caller: models.User = Depends(get_optional_user)):
    sort_key = lambda x: (-x[1]["total_points"], -x[1]["exact_count"], x[0].created_at or datetime.min)
    is_admin = caller is not None and caller.email == ADMIN_EMAIL

    # Ranking actual: incluye partidos EN VIVO (puntos on-the-fly)
    totals = _compute_all_user_totals(db, include_live=True)
    totals.sort(key=sort_key)

    # Ranking previo: SOLO partidos terminados (FT/AET/PEN), para detectar el movimiento
    previous_totals = _compute_all_user_totals(db, include_live=False)
    previous_totals.sort(key=sort_key)
    previous_rank_by_user = {user.id: i + 1 for i, (user, _) in enumerate(previous_totals)}
    previous_points_by_user = {user.id: r["total_points"] for user, r in previous_totals}

    now = datetime.utcnow()
    return [
        schemas.GlobalLeaderboardEntry(
            rank=i + 1,
            user=schemas.LeaderboardUserInfo(
                id=user.id,
                email=user.email,
                name=user.name,
                last_active=user.last_active if is_admin else None,
                is_online=(user.last_active is not None and now - user.last_active <= _ONLINE_WINDOW) if is_admin else None,
            ),
            total_points=result["total_points"],
            exact_matches_count=result["exact_count"],
            diff_matches_count=result["diff_count"],
            tendency_matches_count=result["tendency_count"],
            rank_change=previous_rank_by_user.get(user.id, i + 1) - (i + 1),
            live_points_earned=result["total_points"] - previous_points_by_user.get(user.id, result["total_points"]),
        )
        for i, (user, result) in enumerate(totals)
    ]


@app.get("/users/me/stats", response_model=schemas.UserStats)
def get_my_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    totals = _compute_all_user_totals(db)
    totals.sort(key=lambda x: (-x[1]["total_points"], -x[1]["exact_count"], x[0].created_at or datetime.min))

    rank = next((i + 1 for i, (user, _) in enumerate(totals) if user.id == current_user.id), len(totals))
    result = next(r for user, r in totals if user.id == current_user.id)

    earned_base = result["exact_count"] * 5 + result["diff_count"] * 3 + result["tendency_count"]
    max_base = result["finished_predictions"] * 5
    effectiveness = round(earned_base / max_base * 100, 1) if max_base else 0.0

    return schemas.UserStats(
        total_points=result["total_points"],
        rank=rank,
        total_predictions=result["total_predictions"],
        finished_predictions=result["finished_predictions"],
        exact_count=result["exact_count"],
        tendency_count=result["tendency_count"],
        effectiveness=effectiveness,
    )

@app.get("/admin/force-recalc")
def force_recalc_endpoint():
    try:
        run_recalc()
        return {"status": "success", "message": "Puntos recalculados"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- ENDPOINT ESPÍA PARA DEPURACIÓN MANUAL ---
@app.get("/admin/debug-json")
def debug_json(db: Session = Depends(get_db)):
    preds = db.query(models.ClassicPrediction).all()
    matches = db.query(models.Match).filter(models.Match.status == "FT").all()
    
    return {
        "total_quinielas_guardadas": len(preds),
        "ejemplo_json_usuario": json.loads(preds[0].group_fixtures) if preds and preds[0].group_fixtures else "Vacío",
        "partidos_finalizados": [
            {"home": m.home_team, "away": m.away_team, "home_score": m.home_score, "away_score": m.away_score} 
            for m in matches
        ]
    }

# --- RUTAS DE PARTIDOS ---
_LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP", "IN_PLAY", "PAUSED"}

@app.get("/matches/all", response_model=list[schemas.MatchResponse])
def list_all_matches(db: Session = Depends(get_db)):
    return db.query(models.Match).order_by(models.Match.kickoff_time).all()

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

@app.get("/matches/", response_model=list[schemas.MatchResponse])
def list_matches(db: Session = Depends(get_db)):
    return (
        db.query(models.Match)
        .filter(models.Match.status != "FT")
        .order_by(models.Match.kickoff_time)
        .all()
    )


def _build_user_prediction_lookup(db: Session, home_team: str, away_team: str) -> list[dict]:
    """Devuelve el pronóstico (homeScore/awayScore) de cada usuario para un
    partido dado, buscando en sus fixtures de grupos o, si no aparece ahí,
    en su quiniela de eliminatorias vía bracket_snapshot."""
    home_db = normalize_team_name(home_team)
    away_db = normalize_team_name(away_team)
    home_variants = {
        home_db,
        normalize_team_name(TEAM_TRANSLATIONS.get(home_team, home_team)),
    }
    away_variants = {
        away_db,
        normalize_team_name(TEAM_TRANSLATIONS.get(away_team, away_team)),
    }

    # Resolver api_match_id del partido una sola vez para el lookup directo
    _feed_match = db.query(models.Match).filter(
        func.lower(models.Match.home_team).in_(home_variants),
        func.lower(models.Match.away_team).in_(away_variants),
    ).first()
    _direct_slot_key = str(_feed_match.api_match_id) if _feed_match and _feed_match.api_match_id else None

    picks = []
    users_by_id = {u.id: u for u in db.query(models.User).all()}

    for record in db.query(models.ClassicPrediction).all():
        user = users_by_id.get(record.user_id)
        if not user:
            continue

        try:
            group_fixtures = json.loads(record.group_fixtures or "[]")
        except (TypeError, ValueError):
            group_fixtures = []

        found = None
        for fixture in group_fixtures:
            if not isinstance(fixture, dict):
                continue
            fhome = normalize_team_name(fixture.get("homeTeam", ""))
            faway = normalize_team_name(fixture.get("awayTeam", ""))
            home_match = fhome in home_variants or home_db in _REVERSE_TEAM_MAP.get(fhome, set())
            away_match = faway in away_variants or away_db in _REVERSE_TEAM_MAP.get(faway, set())
            if home_match and away_match:
                found = (fixture.get("homeScore"), fixture.get("awayScore"))
                break

        if found is None:
            try:
                bracket_snapshot = json.loads(record.bracket_snapshot or "{}")
                knockout_scores = json.loads(record.knockout_scores or "{}")
            except (TypeError, ValueError):
                bracket_snapshot, knockout_scores = {}, {}

            for slot_id, teams in (bracket_snapshot or {}).items():
                if not isinstance(teams, dict):
                    continue
                thome = normalize_team_name(teams.get("home", ""))
                taway = normalize_team_name(teams.get("away", ""))
                if thome in home_variants and taway in away_variants:
                    entry = (knockout_scores or {}).get(slot_id, {})
                    if isinstance(entry, dict):
                        found = (entry.get("homeScore"), entry.get("awayScore"))
                    break

        # 3. Lookup directo por api_match_id (usuarios con picks seteados manualmente)
        if found is None and _direct_slot_key:
            entry = (knockout_scores or {}).get(_direct_slot_key, {})
            if isinstance(entry, dict) and entry.get("homeScore") is not None:
                found = (entry.get("homeScore"), entry.get("awayScore"))

        if found is None:
            continue

        pred_home, pred_away = found
        if pred_home is None or pred_away is None:
            continue

        picks.append({
            "user_name": user.name or user.email,
            "pred_home": int(pred_home),
            "pred_away": int(pred_away),
        })

    return picks


def _pick_tendency(pred_home: int, pred_away: int) -> str:
    return "H" if pred_home > pred_away else "A" if pred_away > pred_home else "D"


@app.get("/predictions/daily_feed", response_model=list[schemas.DailyFeedMatch])
def daily_feed(db: Session = Depends(get_db)):
    """Feed global de Picks: los 3 próximos partidos no terminados.

    Velo de privacidad: los marcadores exactos de cada pronóstico solo se
    revelan si faltan 15 minutos o menos para el inicio, o si el partido
    ya está en curso. De lo contrario solo se expone la tendencia (H/D/A).
    """
    try:
        all_matches = (
            db.query(models.Match)
            .order_by(models.Match.kickoff_time)
            .all()
        )

        # Descarta partidos fantasma (equipos con nombre demasiado corto)
        all_matches = [
            m for m in all_matches
            if len((m.home_team or "").strip()) >= 3 and len((m.away_team or "").strip()) >= 3
        ]

        # Los 3 próximos que no hayan terminado (en vivo o por jugar)
        feed_matches = [
            m for m in all_matches
            if m.status not in _FINISHED_MATCH_STATUSES
        ][:3]

        now = datetime.utcnow()
        result = []
        for m in feed_matches:
            is_live_match = m.status in _LIVE_MATCH_STATUSES
            kickoff = m.kickoff_time
            # Normaliza a naive UTC por si el campo trae tzinfo
            if kickoff is not None and kickoff.tzinfo is not None:
                kickoff = kickoff.replace(tzinfo=None)
            time_remaining = (kickoff - now) if kickoff else None
            reveal_scores = is_live_match or (
                time_remaining is not None and time_remaining.total_seconds() <= 15 * 60
            )

            raw_picks = _build_user_prediction_lookup(db, m.home_team, m.away_team)

            picks = []
            for p in raw_picks:
                tendency = _pick_tendency(p["pred_home"], p["pred_away"])
                picks.append(schemas.DailyFeedPick(
                    user_name=p["user_name"],
                    pred_home=p["pred_home"] if reveal_scores else None,
                    pred_away=p["pred_away"] if reveal_scores else None,
                    tendency=tendency,
                ))

            result.append(schemas.DailyFeedMatch(
                id=m.id,
                home_team=m.home_team,
                away_team=m.away_team,
                status=m.status,
                home_score=m.home_score,
                away_score=m.away_score,
                kickoff_time=m.kickoff_time,
                picks=picks,
            ))

        return result
    except Exception:
        return []

# --- RUTAS DE SUPERVIVENCIA ---
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

# --- OTRAS RUTAS ---
@app.get("/predictions/me", response_model=list[schemas.PredictionResponse])
def get_my_predictions(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Prediction).filter(models.Prediction.user_id == current_user.id).all()

@app.post("/admin/sync-results")
def sync_results(current_user: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    fixtures = fb_api.get_finished_fixtures()
    updated = 0
    for fixture in fixtures:
        parsed = fb_api.parse_fixture(fixture)
        if parsed["home_score"] is None: continue
        match = crud.get_match_by_api_id(db, parsed["api_match_id"])
        if match and match.status != "FT":
            crud.finish_match_and_calculate_points(db, match_id=match.id, home_score=parsed["home_score"], away_score=parsed["away_score"])
            updated += 1
    return {"updated": updated}