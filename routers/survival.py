from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
import json

from database import get_db
from deps import get_current_user
import models, schemas

router = APIRouter()

# Mapeo jornada → round tal como lo devuelve API-Football
_JORNADA_TO_ROUND: dict[int, str] = {
    1: "Group Stage - 1",
    2: "Group Stage - 2",
    3: "Group Stage - 3",
    4: "Round of 32",
    5: "Round of 16",
    6: "Quarter-finals",
    7: "Semi-finals",
    8: "Final",
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create(user_id: int, db: Session) -> models.SurvivalPrediction:
    record = db.query(models.SurvivalPrediction).filter(
        models.SurvivalPrediction.user_id == user_id
    ).first()
    if not record:
        record = models.SurvivalPrediction(
            user_id=user_id,
            status="alive",
            picks=json.dumps({}),
            used_teams=json.dumps([]),
            pick_results=json.dumps({}),
        )
        db.add(record)
        db.flush()
    return record


def _find_team_match(team_id: str, jornada_id: int, db: Session) -> Optional[models.Match]:
    """Busca en la BD el partido de la jornada donde juega team_id."""
    round_name = _JORNADA_TO_ROUND.get(jornada_id)
    if not round_name:
        return None
    t = team_id.strip().lower()
    return (
        db.query(models.Match)
        .filter(
            or_(
                func.lower(models.Match.home_team) == t,
                func.lower(models.Match.away_team) == t,
            ),
            func.lower(models.Match.round) == round_name.lower(),
        )
        .first()
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/predictions/survival/pick", response_model=schemas.SurvivalPickResponse)
def make_survival_pick(
    data: schemas.SurvivalPickCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Registra o actualiza el pick de supervivencia para una jornada."""
    if not current_user.has_paid_survival:
        raise HTTPException(status_code=403, detail="Necesitas el pase de Supervivencia para participar.")

    record = _get_or_create(current_user.id, db)
    picks = json.loads(record.picks or "{}")

    # ── Candado 1: Eliminado ──────────────────────────────────────────────────
    if record.status == "eliminated":
        raise HTTPException(
            status_code=403,
            detail=f"Estás eliminado en la jornada {record.eliminated_in_round}. No puedes hacer más picks.",
        )

    # ── Candado 2: Regla de Oro — no repetir equipo en otra jornada ──────────
    jornada_str = str(data.jornada_id)
    teams_in_other_rounds = [t for j, t in picks.items() if j != jornada_str]
    if data.team_id in teams_in_other_rounds:
        raise HTTPException(
            status_code=400,
            detail=f"'{data.team_id}' ya fue utilizado en otra jornada. Elige un equipo diferente.",
        )

    # ── Candado 3: Kickoff — rechazar si el partido ya comenzó ───────────────
    match = _find_team_match(data.team_id, data.jornada_id, db)
    if match and match.kickoff_time:
        kickoff_utc = match.kickoff_time.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) >= kickoff_utc:
            raise HTTPException(
                status_code=423,
                detail=f"El partido de {data.team_id} ya comenzó. No puedes cambiar tu pick.",
            )

    # ── Guardar ───────────────────────────────────────────────────────────────
    picks[jornada_str] = data.team_id
    record.picks      = json.dumps(picks)
    record.used_teams = json.dumps(list(picks.values()))
    record.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()

    return schemas.SurvivalPickResponse(
        jornada_id=data.jornada_id,
        team_id=data.team_id,
        saved_at=record.updated_at,
    )


@router.get("/predictions/survival/me", response_model=schemas.SurvivalStatusResponse)
def get_my_survival_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Devuelve el estado completo de supervivencia del usuario autenticado."""
    if not current_user.has_paid_survival:
        raise HTTPException(status_code=403, detail="Necesitas el pase de Supervivencia para participar.")

    record = db.query(models.SurvivalPrediction).filter(
        models.SurvivalPrediction.user_id == current_user.id
    ).first()

    if not record:
        return schemas.SurvivalStatusResponse(
            status="alive",
            picks={},
            used_teams=[],
            pick_results={},
            extra_life_available=current_user.has_extra_life,
            extra_life_used=False,
            eliminated_in_round=None,
            updated_at=None,
        )

    return schemas.SurvivalStatusResponse(
        status=record.status,
        picks=json.loads(record.picks        or "{}"),
        used_teams=json.loads(record.used_teams  or "[]"),
        pick_results=json.loads(record.pick_results or "{}"),
        extra_life_available=record.extra_life_available,
        extra_life_used=record.extra_life_used,
        eliminated_in_round=record.eliminated_in_round,
        updated_at=record.updated_at,
    )


@router.delete("/predictions/survival/pick/{jornada_id}", status_code=204)
def delete_survival_pick(
    jornada_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Elimina el pick de una jornada (solo si el partido aún no comenzó)."""
    record = db.query(models.SurvivalPrediction).filter(
        models.SurvivalPrediction.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Sin picks guardados.")
    if record.status == "eliminated":
        raise HTTPException(status_code=403, detail="Estás eliminado. No puedes modificar picks.")

    picks = json.loads(record.picks or "{}")
    team = picks.get(str(jornada_id))
    if team:
        match = _find_team_match(team, jornada_id, db)
        if match and match.kickoff_time:
            kickoff_utc = match.kickoff_time.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) >= kickoff_utc:
                raise HTTPException(status_code=423, detail=f"La jornada {jornada_id} ya está bloqueada.")

    picks.pop(str(jornada_id), None)
    record.picks      = json.dumps(picks)
    record.used_teams = json.dumps(list(picks.values()))
    record.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
