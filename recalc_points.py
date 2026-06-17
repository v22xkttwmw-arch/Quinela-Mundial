"""
Script temporal: recalcula puntos clásicos de todos los usuarios usando
compute_live_classic_score (lookup por api_match_id, inmune a nombres de equipos).
Corre una sola vez y elimínalo.
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
import models
from services.scoring import compute_live_classic_score, normalize_team_name

FINISHED = {"FT", "AET", "PEN"}
LIVE     = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP", "IN_PLAY", "PAUSED"}
VALID    = FINISHED | LIVE

TEAM_TRANSLATIONS = {
    "Mexico": "México", "South Africa": "Sudáfrica", "South Korea": "Corea del Sur",
    "Czech Republic": "República Checa", "Canada": "Canadá",
    "Bosnia & Herzegovina": "Bosnia y Herzegovina", "Bosnia-Herzegovina": "Bosnia y Herzegovina",
    "Switzerland": "Suiza", "Brazil": "Brasil", "Scotland": "Escocia",
    "Morocco": "Marruecos", "Turkey": "Turquía", "Türkiye": "Turquía",
    "USA": "Estados Unidos", "Germany": "Alemania", "Ivory Coast": "Costa de Marfil",
    "Cote D'Ivoire": "Costa de Marfil", "Japan": "Japón", "Netherlands": "Países Bajos",
    "Sweden": "Suecia", "Tunisia": "Túnez", "Belgium": "Bélgica", "Egypt": "Egipto",
    "Iran": "Irán", "New Zealand": "Nueva Zelanda", "Saudi Arabia": "Arabia Saudita",
    "Cape Verde": "Cabo Verde", "Spain": "España", "France": "Francia",
    "Norway": "Noruega", "Jordan": "Jordania", "England": "Inglaterra",
    "Panama": "Panamá", "Uzbekistan": "Uzbekistán", "Algeria": "Argelia",
    "DR Congo": "RD Congo", "Haiti": "Haití", "Croatia": "Croacia", "Senegal": "Senegal",
}


def build_match_lookup(db):
    lookup = {}
    for m in db.query(models.Match).all():
        if m.api_match_id is None:
            continue
        if m.status in VALID and m.home_score is not None and m.away_score is not None:
            home_es = TEAM_TRANSLATIONS.get(m.home_team, m.home_team)
            away_es = TEAM_TRANSLATIONS.get(m.away_team, m.away_team)
            lookup[str(m.api_match_id)] = {
                "home_score": m.home_score,
                "away_score": m.away_score,
                "home_team":  normalize_team_name(home_es),
                "away_team":  normalize_team_name(away_es),
            }
    return lookup


def run():
    db = SessionLocal()
    try:
        match_lookup = build_match_lookup(db)
        print(f"Partidos con marcador en el lookup: {len(match_lookup)}")
        for mid, m in match_lookup.items():
            print(f"  ID {mid}: {m['home_team']} {m['home_score']}-{m['away_score']} {m['away_team']}")

        records  = {r.user_id: r for r in db.query(models.ClassicPrediction).all()}
        users    = db.query(models.User).all()
        updated  = 0

        for user in users:
            record = records.get(user.id)
            if not record:
                continue

            result = compute_live_classic_score(
                group_fixtures   = json.loads(record.group_fixtures   or "[]"),
                knockout_scores  = json.loads(record.knockout_scores  or "{}"),
                bracket_snapshot = json.loads(record.bracket_snapshot or "{}"),
                match_by_teams   = match_lookup,
            )

            pts = result["total_points"]
            user.total_points                 = pts
            record.total_points_classic       = pts
            record.exact_count_classic        = result["exact_count"]

            updated += 1
            print(f"  {user.name or user.email}: {pts} pts "
                  f"(E:{result['exact_count']} D:{result['diff_count']} T:{result['tendency_count']})")

        db.commit()
        print(f"\n✅ {updated} usuarios actualizados.")
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
