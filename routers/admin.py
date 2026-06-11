import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from deps import get_current_admin
from services.live_updater import fetch_and_update_matches

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/force-sync")
async def force_sync(_: models.User = Depends(get_current_admin)):
    """Ejecuta fetch_and_update_matches() a demanda, sin esperar al temporizador."""
    return await fetch_and_update_matches()


@router.get("/users-audit", response_model=list[schemas.UserAuditOut])
def users_audit(db: Session = Depends(get_db)):
    """Auditoría rápida de usuarios: pagos y picks listos antes del torneo."""
    users = db.query(models.User).order_by(models.User.id).all()

    out: list[schemas.UserAuditOut] = []
    for user in users:
        classic = user.classic_prediction
        classic_total = 0
        classic_filled = 0
        if classic and classic.group_fixtures:
            fixtures = json.loads(classic.group_fixtures)
            classic_total = len(fixtures)
            classic_filled = sum(
                1 for f in fixtures
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
        ))

    return out
