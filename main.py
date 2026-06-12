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
from services.scoring import calculate_user_score, compute_live_classic_score
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

def _build_match_lookup(db: Session) -> dict[tuple[str, str], dict]:
    """Mapea (home_team.lower(), away_team.lower()) -> {home_score, away_score}."""
    matches = db.query(models.Match).all()
    return {
        (m.home_team.strip().lower(), m.away_team.strip().lower()): {
            "home_score": m.home_score,
            "away_score": m.away_score,
        }
        for m in matches
    }


def _compute_all_user_totals(db: Session) -> list[tuple[models.User, dict]]:
    """Calcula en vivo los puntos de cada usuario cruzando su ClassicPrediction con Match."""
    match_by_teams = _build_match_lookup(db)
    records = {r.user_id: r for r in db.query(models.ClassicPrediction).all()}

    empty = {"total_points": 0, "exact_count": 0, "diff_count": 0, "tendency_count": 0,
             "total_predictions": 0, "finished_predictions": 0}

    totals = []
    for user in db.query(models.User).all():
        record = records.get(user.id)
        if record:
            result = compute_live_classic_score(
                group_fixtures=json.loads(record.group_fixtures or "[]"),
                knockout_scores=json.loads(record.knockout_scores or "{}"),
                bracket_snapshot=json.loads(record.bracket_snapshot or "{}"),
                match_by_teams=match_by_teams,
            )
        else:
            result = dict(empty)
        totals.append((user, result))
    return totals


@app.get("/leaderboard/global", response_model=list[schemas.GlobalLeaderboardEntry])
def global_leaderboard(db: Session = Depends(get_db)):
    totals = _compute_all_user_totals(db)
    totals.sort(key=lambda x: (-x[1]["total_points"], -x[1]["exact_count"], x[0].created_at or datetime.min))
    return [
        schemas.GlobalLeaderboardEntry(
            rank=i + 1,
            user=schemas.LeaderboardUserInfo(id=user.id, email=user.email, name=user.name),
            total_points=result["total_points"],
            exact_matches_count=result["exact_count"],
            diff_matches_count=result["diff_count"],
            tendency_matches_count=result["tendency_count"],
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

# --- RUTAS DE PARTIDOS ---
_LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"}

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