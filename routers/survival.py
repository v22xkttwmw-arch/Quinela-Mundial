from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import json

from database import get_db
from deps import get_current_user
import models, schemas

router = APIRouter()

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create(user_id: int, db: Session) -> models.SurvivalPrediction:
    """Devuelve el registro de supervivencia del usuario, o lo crea si no existe."""
    record = db.query(models.SurvivalPrediction).filter(
        models.SurvivalPrediction.user_id == user_id
    ).first()
    if not record:
        record = models.SurvivalPrediction(
            user_id=user_id,
            status="alive",
            picks=json.dumps({}),
            used_teams=json.dumps([]),
        )
        db.add(record)
        db.flush()  # obtener ID sin commit
    return record


def _is_jornada_locked(jornada_id: int, db: Session) -> bool:
    """
    Candado de Tiempo: verifica si la jornada ya está bloqueada.
    Una jornada se bloquea 2 horas antes del pitazo del primer partido que la compone.

    Implementación actual: delega en los partidos de la BD marcados con
    la jornada correspondiente. Retorna False hasta que se configure el
    mapeo jornada → matches (ver TODO abajo).

    TODO: añadir columna `jornada_id` a la tabla `matches` y filtrar aquí:
        match = db.query(models.Match)
            .filter(models.Match.jornada_id == jornada_id)
            .order_by(models.Match.kickoff_time)
            .first()
        if match and match.kickoff_time:
            lock_at = match.kickoff_time - timedelta(hours=2)
            return datetime.now(timezone.utc) >= lock_at.replace(tzinfo=timezone.utc)
    """
    return False


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
    picks      = json.loads(record.picks      or "{}")
    used_teams = json.loads(record.used_teams or "[]")

    # ── Candado 1: Estado ─────────────────────────────────────────────────────
    if record.status == "eliminated":
        raise HTTPException(
            status_code=403,
            detail=f"Estás eliminado en la jornada {record.eliminated_in_round}. No puedes hacer más picks.",
        )

    # ── Candado 2: Regla de Oro (desgaste de equipos) ─────────────────────────
    jornada_str = str(data.jornada_id)
    existing_pick = picks.get(jornada_str)

    # Si ya hay pick en ESTA jornada, el equipo anterior libera el "slot" del desgaste
    # pero si el NUEVO equipo ya fue usado en OTRA jornada, bloqueamos.
    teams_in_other_rounds = [t for j, t in picks.items() if j != jornada_str]
    if data.team_id in teams_in_other_rounds:
        raise HTTPException(
            status_code=400,
            detail=f"El equipo '{data.team_id}' ya fue utilizado en otra jornada. Elige un equipo diferente.",
        )

    # ── Candado 3: Tiempo ─────────────────────────────────────────────────────
    if _is_jornada_locked(data.jornada_id, db):
        raise HTTPException(
            status_code=423,
            detail=f"La jornada {data.jornada_id} ya está bloqueada. No se puede modificar el pick.",
        )

    # ── Guardar ───────────────────────────────────────────────────────────────
    picks[jornada_str] = data.team_id

    # Reconstruir used_teams desde todos los picks activos
    record.picks      = json.dumps(picks)
    record.used_teams = json.dumps(list(picks.values()))
    record.updated_at = datetime.utcnow()
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
        # Usuario pagado pero aún no ha hecho ningún pick
        return schemas.SurvivalStatusResponse(
            status="alive",
            picks={},
            used_teams=[],
            extra_life_available=current_user.has_extra_life,
            extra_life_used=False,
            eliminated_in_round=None,
            updated_at=None,
        )

    return schemas.SurvivalStatusResponse(
        status=record.status,
        picks=json.loads(record.picks      or "{}"),
        used_teams=json.loads(record.used_teams or "[]"),
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
    """Elimina el pick de una jornada (solo si no está bloqueada)."""
    record = db.query(models.SurvivalPrediction).filter(
        models.SurvivalPrediction.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Sin picks guardados.")

    if record.status == "eliminated":
        raise HTTPException(status_code=403, detail="Estás eliminado. No puedes modificar picks.")

    if _is_jornada_locked(jornada_id, db):
        raise HTTPException(status_code=423, detail=f"La jornada {jornada_id} ya está bloqueada.")

    picks = json.loads(record.picks or "{}")
    picks.pop(str(jornada_id), None)
    record.picks      = json.dumps(picks)
    record.used_teams = json.dumps(list(picks.values()))
    record.updated_at = datetime.utcnow()
    db.commit()
