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

# --- Configuración ---
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
INSCRIPTION_PRICE_CENTS = int(os.getenv("INSCRIPTION_PRICE_CENTS", 1000))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")]
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

app = FastAPI(title="Quiniela API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- Routers ---
app.include_router(groups.router)
app.include_router(classic.router)
app.include_router(survival.router)
app.include_router(admin.router)

@app.on_event("startup")
async def _startup():
    try:
        inspector = sa_inspect(engine)
        if "group_name" not in [c["name"] for c in inspector.get_columns("matches")]:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE matches ADD COLUMN group_name VARCHAR"))
                conn.commit()
    except: pass
    asyncio.create_task(start_live_updater_loop())

@app.get("/")
def read_root(): return {"message": "API activa"}

# --- RUTAS PRINCIPALES ---
@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    access_token = auth.create_access_token(data={"sub": user.email})
    response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    response.set_cookie(key="token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite="none" if COOKIE_SECURE else "lax")
    return response

@app.get("/leaderboard/global", response_model=list[schemas.GlobalLeaderboardEntry])
def global_leaderboard(db: Session = Depends(get_db)):
    matches = db.query(models.Match).filter(models.Match.home_score.isnot(None)).all()
    match_dict = {m.id: m for m in matches}
    users = db.query(models.User).all()
    raw = []
    for user in users:
        user_preds = db.query(models.Prediction).filter(models.Prediction.user_id == user.id).all()
        total, exact, diff, tendency = 0, 0, 0, 0
        for p in user_preds:
            match = match_dict.get(p.match_id)
            if not match: continue
            pts = 0
            if p.predicted_home == match.home_score and p.predicted_away == match.away_score: pts = 5
            elif (match.home_score - match.away_score) == (p.predicted_home - p.predicted_away): pts = 3
            elif (match.home_score > match.away_score and p.predicted_home > p.predicted_away) or \
                 (match.home_score < match.away_score and p.predicted_home < p.predicted_away) or \
                 (match.home_score == match.away_score and p.predicted_home == p.predicted_away): pts = 1
            total += pts
            if pts == 5: exact += 1
            elif pts == 3: diff += 1
            elif pts == 1: tendency += 1
        raw.append({"user": user, "total_points": total, "exact_matches_count": exact, "diff_matches_count": diff, "tendency_matches_count": tendency})
    raw.sort(key=lambda x: (-x["total_points"], -x["exact_matches_count"], x["user"].created_at or datetime.min))
    return [schemas.GlobalLeaderboardEntry(rank=i+1, user=schemas.LeaderboardUserInfo(id=e["user"].id, email=e["user"].email, name=e["user"].name), total_points=e["total_points"], exact_matches_count=e["exact_matches_count"], diff_matches_count=e["diff_matches_count"], tendency_matches_count=e["tendency_matches_count"]) for i, e in enumerate(raw)]

@app.get("/admin/force-recalc")
def force_recalc_endpoint():
    try:
        run_recalc()
        return {"status": "success", "message": "Puntos recalculados"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

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
        if parsed["home_score"] is None or parsed["away_score"] is None: continue
        match = crud.get_match_by_api_id(db, parsed["api_match_id"])
        if match and match.status != "FT":
            crud.finish_match_and_calculate_points(db, match_id=match.id, home_score=parsed["home_score"], away_score=parsed["away_score"])
            updated += 1
    return {"updated": updated}