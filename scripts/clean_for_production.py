"""
clean_for_production.py — Vacía los datos de prueba antes del lanzamiento.

Borra TODAS las filas de:
  • predictions
  • survival_predictions
  • survivor_picks
  • classic_predictions
  • group_members
  • payments
  • leaderboard
  • users

(classic_predictions y group_members se incluyen porque tienen FK a users
y quedarían huérfanas/bloqueando el borrado si no se limpian también).

NO TOCA: matches ni groups (calendario y estructura de grupos quedan intactos).

Uso:
    python scripts/clean_for_production.py        (DB local)
    railway run python scripts/clean_for_production.py   (DB de producción)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import SessionLocal
import models


def clean(db):
    deleted = {
        "predictions": db.query(models.Prediction).delete(),
        "survival_predictions": db.query(models.SurvivalPrediction).delete(),
        "survivor_picks": db.query(models.SurvivorPick).delete(),
        "classic_predictions": db.query(models.ClassicPrediction).delete(),
        "group_members": db.query(models.GroupMember).delete(),
        "payments": db.query(models.Payment).delete(),
        "leaderboard": db.query(models.Leaderboard).delete(),
        "users": db.query(models.User).delete(),
    }
    for table, count in deleted.items():
        print(f"{table}: {count} filas eliminadas")


def main():
    db = SessionLocal()
    try:
        clean(db)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
