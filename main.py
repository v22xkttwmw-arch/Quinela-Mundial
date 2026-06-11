from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, crud, auth
from routers import groups, classic, survival, admin
from recalc import run_recalc
import os

app = FastAPI(title="Quiniela API")

# Solo routers
app.include_router(groups.router)
app.include_router(classic.router)
app.include_router(survival.router)
app.include_router(admin.router)

@app.get("/")
def read_root(): return {"message": "API activa"}

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
    raw.sort(key=lambda x: (-x["total_points"], -x["exact_matches_count"]))
    return [schemas.GlobalLeaderboardEntry(rank=i+1, user=schemas.LeaderboardUserInfo(id=e["user"].id, email=e["user"].email, name=e["user"].name), total_points=e["total_points"], exact_matches_count=e["exact_matches_count"], diff_matches_count=e["diff_matches_count"], tendency_matches_count=e["tendency_matches_count"]) for i, e in enumerate(raw)]

@app.get("/admin/force-recalc")
def force_recalc():
    try:
        run_recalc()
        return {"status": "success", "message": "Puntos recalculados"}
    except Exception as e: return {"status": "error", "message": str(e)}