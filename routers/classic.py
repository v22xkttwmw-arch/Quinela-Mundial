from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json

from database import get_db
from deps import get_current_user
import models, schemas

router = APIRouter()


@router.post("/predictions/classic", response_model=schemas.ClassicPredictionResponse)
def save_classic_prediction(
    data: schemas.ClassicPredictionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.has_paid_classic:
        raise HTTPException(status_code=403, detail="Debes pagar para guardar tu quiniela clásica")

    fixtures_json = json.dumps([f.model_dump() for f in data.group_fixtures])
    knockout_json = json.dumps({k: v.model_dump() for k, v in data.knockout_scores.items()})

    record = db.query(models.ClassicPrediction).filter(
        models.ClassicPrediction.user_id == current_user.id
    ).first()

    if record:
        record.group_fixtures = fixtures_json
        record.knockout_scores = knockout_json
        record.updated_at = datetime.utcnow()
    else:
        record = models.ClassicPrediction(
            user_id=current_user.id,
            group_fixtures=fixtures_json,
            knockout_scores=knockout_json,
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
        "group_fixtures": json.loads(record.group_fixtures),
        "knockout_scores": json.loads(record.knockout_scores),
        "updated_at": record.updated_at,
    }
