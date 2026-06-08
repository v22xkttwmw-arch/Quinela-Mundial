from fastapi import APIRouter, Depends

import models
from deps import get_current_admin
from services.live_updater import fetch_and_update_matches

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/force-sync")
async def force_sync(_: models.User = Depends(get_current_admin)):
    """Ejecuta fetch_and_update_matches() a demanda, sin esperar al temporizador."""
    return await fetch_and_update_matches()
