import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import SessionLocal, engine
from models import Base, Match

MATCHES = [
    ("España",      "Francia"),
    ("Brasil",      "Argentina"),
    ("Alemania",    "Inglaterra"),
    ("Portugal",    "Italia"),
    ("México",      "Colombia"),
    ("Uruguay",     "Chile"),
    ("Holanda",     "Bélgica"),
    ("Croacia",     "Marruecos"),
    ("Senegal",     "Ghana"),
    ("Japón",       "Corea del Sur"),
]

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        base_date = datetime.utcnow() + timedelta(days=1)
        inserted = 0
        skipped = 0
        for i, (home, away) in enumerate(MATCHES):
            api_id = 90001 + i
            existing = db.query(Match).filter(Match.api_match_id == api_id).first()
            if existing:
                skipped += 1
                print(f"  Saltando {home} vs {away} (api_match_id={api_id} ya existe)")
                continue
            kickoff = base_date + timedelta(days=i, hours=i % 3 * 3)
            match = Match(
                api_match_id=api_id,
                home_team=home,
                away_team=away,
                status="NS",
                kickoff_time=kickoff,
            )
            db.add(match)
            inserted += 1
        db.commit()
        print(f"Seed completado: {inserted} insertados, {skipped} saltados")
    except Exception as e:
        db.rollback()
        print(f"Error al insertar datos: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
