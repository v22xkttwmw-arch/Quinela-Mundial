from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime
import json

from database import get_db
from deps import get_current_user
from ratelimit import limiter
from services.scoring import calculate_user_score
import models, schemas

router = APIRouter()


@router.post("/predictions/classic", response_model=schemas.ClassicPredictionResponse)
@limiter.limit("10/minute")
def save_classic_prediction(
    request: Request,
    data: schemas.ClassicPredictionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.has_paid_classic:
        raise HTTPException(status_code=403, detail="Debes pagar para guardar tu quiniela clásica")

    fixtures_json   = json.dumps([f.model_dump() for f in data.group_fixtures])
    knockout_json   = json.dumps({k: v.model_dump() for k, v in data.knockout_scores.items()})
    thirds_json     = json.dumps(data.selected_thirds or [])
    assign_json     = json.dumps(data.third_assignments or {})
    bracket_gen     = data.is_bracket_generated or False
    captain_json    = json.dumps(data.captain_matches or [])
    snapshot_json   = json.dumps(data.bracket_snapshot or {})

    record = db.query(models.ClassicPrediction).filter(
        models.ClassicPrediction.user_id == current_user.id
    ).first()

    if record:
        record.group_fixtures        = fixtures_json
        record.knockout_scores       = knockout_json
        record.selected_thirds       = thirds_json
        record.third_assignments     = assign_json
        record.is_bracket_generated  = bracket_gen
        record.captain_matches       = captain_json
        record.bracket_snapshot      = snapshot_json
        # 🔥 Guarda los nuevos premios en el registro existente
        record.top_scorer            = data.top_scorer
        record.top_assist            = data.top_assist
        record.best_young_player     = data.best_young_player
        record.updated_at            = datetime.utcnow()
    else:
        record = models.ClassicPrediction(
            user_id=current_user.id,
            group_fixtures=fixtures_json,
            knockout_scores=knockout_json,
            selected_thirds=thirds_json,
            third_assignments=assign_json,
            is_bracket_generated=bracket_gen,
            captain_matches=captain_json,
            bracket_snapshot=snapshot_json,
            # 🔥 Guarda los nuevos premios al crear por primera vez
            top_scorer=data.top_scorer,
            top_assist=data.top_assist,
            best_young_player=data.best_young_player,
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return record


@router.get("/predictions/classic", response_model=schemas.ClassicPredictionFull)
def get_classic_prediction(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    record = db.query(models.ClassicPrediction).filter(
        models.ClassicPrediction.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Sin quiniela guardada")
    return {
        "group_fixtures":        json.loads(record.group_fixtures),
        "knockout_scores":       json.loads(record.knockout_scores),
        "selected_thirds":       json.loads(record.selected_thirds   or "[]"),
        "third_assignments":     json.loads(record.third_assignments  or "{}"),
        "is_bracket_generated":  record.is_bracket_generated or False,
        "captain_matches":       json.loads(record.captain_matches    or "[]"),
        "bracket_snapshot":      json.loads(record.bracket_snapshot   or "{}") or None,
        "total_points_classic":  record.total_points_classic  or 0,
        "exact_count_classic":   record.exact_count_classic   or 0,
        "effectiveness_classic": record.effectiveness_classic or 0.0,
        "updated_at":            record.updated_at,
        # 🔥 Devuelve los valores de los jugadores para pintar las casillas del usuario
        "top_scorer":            record.top_scorer,
        "top_assist":            record.top_assist,
        "best_young_player":     record.best_young_player,
    }


@router.post("/predictions/classic/score", response_model=schemas.ClassicScoreResponse)
def score_classic_prediction(
    data: schemas.ClassicScoreRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Calcula y persiste la puntuación de la quiniela clásica del usuario."""
    record = db.query(models.ClassicPrediction).filter(
        models.ClassicPrediction.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Sin quiniela guardada")

    group_fixtures   = json.loads(record.group_fixtures)
    knockout_scores  = json.loads(record.knockout_scores)
    captain_matches  = json.loads(record.captain_matches or "[]")

    real_knockout = {
        slot_id: entry.model_dump()
        for slot_id, entry in data.real_knockout_results.items()
    }
    real_groups = [m.model_dump() for m in data.real_group_results]

    result = calculate_user_score(
        group_fixtures=group_fixtures,
        knockout_scores=knockout_scores,
        captain_matches=captain_matches,
        real_group_results=real_groups,
        real_knockout_results=real_knockout,
        predicted_champion=None,    
        real_champion=data.real_champion,
    )

    # ─── CÁLCULO DE PUNTOS EXTRAS POR PREMIOS INDIVIDUALES ───
    top_scorer_bonus = 0
    top_assist_bonus = 0
    best_young_player_bonus = 0

    def clean_str(s: str | None) -> str:
        return s.strip().lower() if s else ""

    if record.top_scorer and data.real_top_scorer and clean_str(record.top_scorer) == clean_str(data.real_top_scorer):
        top_scorer_bonus = 10
    if record.top_assist and data.real_top_assist and clean_str(record.top_assist) == clean_str(data.real_top_assist):
        top_assist_bonus = 10
    if record.best_young_player and data.real_best_young_player and clean_str(record.best_young_player) == clean_str(data.real_best_young_player):
        best_young_player_bonus = 10

    # Inyectamos los puntos de bonus calculados al total
    result["total_points"] += (top_scorer_bonus + top_assist_bonus + best_young_player_bonus)
    result["top_scorer_bonus"] = top_scorer_bonus
    result["top_assist_bonus"] = top_assist_bonus
    result["best_young_player_bonus"] = best_young_player_bonus

    # Persistir stats calculadas
    record.total_points_classic  = result["total_points"]
    record.exact_count_classic   = result["exact_count"]
    record.effectiveness_classic = result["effectiveness"]
    db.commit()

    return result