import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud, models
import schemas
from database import get_db
from deps import get_current_admin
from services.live_updater import fetch_and_update_matches

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/force-sync")
async def force_sync(_: models.User = Depends(get_current_admin)):
    """Ejecuta fetch_and_update_matches() a demanda, sin esperar al temporizador."""
    return await fetch_and_update_matches()


@router.post("/fix-match-score")
def fix_match_score(
    match_id: int,
    home_score: int,
    away_score: int,
    winning_team: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """Corrige el marcador de un partido ya finalizado y recalcula todos los puntos.

    Usar cuando el stale-check cerró el partido con marcador incorrecto
    (ej. gol en tiempo agregado no capturado a tiempo).
    """
    result = crud.rescore_match(db, match_id, home_score, away_score, winning_team)
    if not result:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    return {
        "ok": True,
        "match_id": match_id,
        "home_score": result.home_score,
        "away_score": result.away_score,
        "status": result.status,
    }


@router.get("/users-audit", response_model=list[schemas.UserAuditOut])
def users_audit(db: Session = Depends(get_db)):
    """Auditoría rápida de usuarios: pagos y picks listos antes del torneo."""
    users = db.query(models.User).order_by(models.User.id).all()

    out: list[schemas.UserAuditOut] = []
    for user in users:
        classic = user.classic_prediction
        classic_total = 0
        classic_filled = 0
        classic_fixtures: list[dict] = []
        if classic and classic.group_fixtures:
            classic_fixtures = json.loads(classic.group_fixtures)
            classic_total = len(classic_fixtures)
            classic_filled = sum(
                1 for f in classic_fixtures
                if f.get("homeScore") is not None and f.get("awayScore") is not None
            )

        survival = user.survival_prediction
        survival_status = survival.status if survival else None
        survival_jornada1 = None
        if survival and survival.picks:
            picks = json.loads(survival.picks)
            survival_jornada1 = picks.get("1")

        out.append(schemas.UserAuditOut(
            id=user.id,
            name=user.name or user.email,
            email=user.email,
            has_paid_classic=user.has_paid_classic,
            has_paid_survival=user.has_paid_survival,
            classic_picks_filled=classic_filled,
            classic_picks_total=classic_total,
            survival_status=survival_status,
            survival_jornada1_pick=survival_jornada1,
            classic_picks=classic_fixtures,
            login_count=user.login_count or 0,
            last_active=user.last_active,
        ))

    return out
