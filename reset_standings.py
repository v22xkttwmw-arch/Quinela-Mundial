#!/usr/bin/env python3
"""
reset_standings.py — Pone a cero el marcador de la liga antes del torneo.

QUÉ resetea:
  • leaderboard.total_points / exact_matches_count / rank_position
  • users.total_points
  • classic_predictions.total_points_classic / exact_count_classic / effectiveness_classic

QUÉ NO toca:
  • Los goles predichos por cada usuario (classic_predictions.group_fixtures).
    Esos son datos del usuario, no del marcador.
  • Los resultados reales de los partidos (matches.home_score / away_score).

NOTA sobre "Mejores Terceros":
  Ese ranking NO vive en la base de datos. Se calcula en el navegador con
  la función compareThirds cada vez que el usuario carga la página.
  Si ves resultados viejos, haz Ctrl+Shift+R para forzar el nuevo bundle JS.

Uso:
    railway run python reset_standings.py
"""
import sys
from dotenv import load_dotenv
load_dotenv()

from database import SessionLocal
import models


def main() -> None:
    db = SessionLocal()
    try:
        # ── Leaderboard ──────────────────────────────────────────────────────────
        lb_rows = db.query(models.Leaderboard).all()
        for row in lb_rows:
            row.total_points        = 0
            row.exact_matches_count = 0
            row.rank_position       = None

        # ── users.total_points ───────────────────────────────────────────────────
        users = db.query(models.User).all()
        for user in users:
            user.total_points = 0

        # ── ClassicPrediction — solo puntuación, no los goles del usuario ────────
        classic_preds = db.query(models.ClassicPrediction).all()
        for cp in classic_preds:
            cp.total_points_classic  = 0
            cp.exact_count_classic   = 0
            cp.effectiveness_classic = 0.0

        db.commit()

        print(f"✓  Leaderboard:          {len(lb_rows)} filas reseteadas")
        print(f"✓  Users.total_points:   {len(users)} usuarios reseteados")
        print(f"✓  Classic puntuación:   {len(classic_preds)} filas reseteadas")
        print()
        print("Goles predichos y resultados reales de partidos: intactos.")
        print("Para ver compareThirds en acción: Ctrl+Shift+R en el navegador.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
