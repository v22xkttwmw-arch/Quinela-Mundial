"""
Reseteo total: matches, predictions, leaderboard y puntos de usuario.

Borra los partidos y predicciones sembrados con nombres en español (para
repoblar desde API-Football, cuyos nombres vienen en inglés) y limpia
también el leaderboard y User.total_points, que de otro modo quedarían
apuntando a predicciones ya eliminadas.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import SessionLocal
import models


def clean_matches_and_predictions(db):
    deleted_predictions = db.query(models.Prediction).delete()
    deleted_matches = db.query(models.Match).delete()
    print(f"Predicciones eliminadas: {deleted_predictions}")
    print(f"Partidos eliminados: {deleted_matches}")


def reset_scores(db):
    deleted_leaderboard = db.query(models.Leaderboard).delete()
    reset_users = db.query(models.User).update({models.User.total_points: 0})
    print(f"Entradas de leaderboard eliminadas: {deleted_leaderboard}")
    print(f"Usuarios con total_points reseteado a 0: {reset_users}")


def clean(reset_matches: bool = True, reset_points: bool = True):
    db = SessionLocal()
    try:
        if reset_matches:
            clean_matches_and_predictions(db)
        if reset_points:
            reset_scores(db)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    clean()
