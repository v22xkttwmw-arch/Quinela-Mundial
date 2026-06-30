"""
Manual correction: set predictions for South Africa vs Canada match.
Run via: railway run python scripts/set_predictions_sudafrica_canada.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Match, User, Prediction
from datetime import datetime
from sqlalchemy import func

db = SessionLocal()

# ── 1. Find the match ──────────────────────────────────────────────────────
match = db.query(Match).filter(
    ((Match.home_team.ilike('%South Africa%')) & (Match.away_team.ilike('%Canada%'))) |
    ((Match.home_team.ilike('%Canada%')) & (Match.away_team.ilike('%South Africa%')))
).first()

if not match:
    # Try with Spanish names
    match = db.query(Match).filter(
        ((Match.home_team.ilike('%Sudáfrica%')) & (Match.away_team.ilike('%Canad%'))) |
        ((Match.home_team.ilike('%Canad%')) & (Match.away_team.ilike('%Sudáfrica%'))) |
        ((Match.home_team.ilike('%Sudafrica%')) & (Match.away_team.ilike('%Canada%'))) |
        ((Match.home_team.ilike('%Canada%')) & (Match.away_team.ilike('%Sudafrica%')))
    ).first()

if not match:
    print("ERROR: No se encontró el partido Sudáfrica vs Canadá")
    print("Partidos disponibles con Canada o South Africa:")
    for m in db.query(Match).filter(
        Match.home_team.ilike('%Canada%') | Match.away_team.ilike('%Canada%') |
        Match.home_team.ilike('%South Africa%') | Match.away_team.ilike('%South Africa%') |
        Match.home_team.ilike('%Sudafrica%') | Match.away_team.ilike('%Sudafrica%')
    ).all():
        print(f"  ID={m.id}, api_match_id={m.api_match_id}, {m.home_team} vs {m.away_team}, round={m.round}")
    db.close()
    sys.exit(1)

print(f"Partido encontrado: ID={match.id}, api_match_id={match.api_match_id}, {match.home_team} vs {match.away_team}")

# ── 2. Predictions to set ──────────────────────────────────────────────────
# Format: (name_fragment, home_score, away_score)
# Canada is AWAY if home=South Africa, or HOME if home=Canada
# User said "favor Canada" means Canada wins
# South Africa vs Canada: home=South Africa, away=Canada
# "2-1 favor Canada" => South Africa 1, Canada 2 => predicted_home=1, predicted_away=2
# BUT if the match is "Canada vs South Africa" then home=Canada, away=South Africa
# "2-1 favor Canada" => Canada 2, South Africa 1 => predicted_home=2, predicted_away=1

home_is_canada = 'canada' in match.home_team.lower()

def scores_for(canada_score, other_score):
    """Return (predicted_home, predicted_away) based on who is home."""
    if home_is_canada:
        return canada_score, other_score
    else:
        return other_score, canada_score

PREDICTIONS = [
    # (name_fragment,                   canada_score, other_score)
    ("Gerardo",                          2, 1),   # 2-1 favor Canada
    ("Imanol",                           2, 0),   # 2-0 favor Canada
    ("Fernando",                         3, 1),   # 3-1 ganando Canada
    ("Sebas",                            2, 1),   # 2-1 favor Canada
    ("Cobo",                             2, 0),   # 2-0 favor Canada (Santiago Cobo)
    # Santiago Magaña: 1-2 favor Sudáfrica → Canada 1, South Africa 2
]

# Santiago Magaña is special: 1-2 favor Sudáfrica
SUDAFRICA_PREDICTIONS = [
    ("Santiago Magaña",                  1, 2),   # South Africa 2, Canada 1
]

print(f"\nhome_is_canada={home_is_canada}")
print(f"home={match.home_team}, away={match.away_team}")

# ── 3. All users ──────────────────────────────────────────────────────────
all_users = db.query(User).all()
print(f"\nUsuarios en DB ({len(all_users)}):")
for u in all_users:
    print(f"  ID={u.id}, name='{u.name}'")

def find_user(fragment):
    fragment_lower = fragment.lower()
    for u in all_users:
        if fragment_lower in (u.name or '').lower():
            return u
    return None

def upsert_prediction(user, ph, pa):
    pred = db.query(Prediction).filter_by(user_id=user.id, match_id=match.id).first()
    if pred:
        old = f"{pred.predicted_home}-{pred.predicted_away}"
        pred.predicted_home = ph
        pred.predicted_away = pa
        pred.updated_at = datetime.utcnow()
        print(f"  UPDATED {user.name}: {old} → {ph}-{pa}")
    else:
        pred = Prediction(
            user_id=user.id,
            match_id=match.id,
            predicted_home=ph,
            predicted_away=pa,
            updated_at=datetime.utcnow(),
        )
        db.add(pred)
        print(f"  CREATED {user.name}: {ph}-{pa}")

print("\n=== Aplicando predicciones ===")

# Canada-favor predictions
for (fragment, canada_score, other_score) in PREDICTIONS:
    user = find_user(fragment)
    if not user:
        print(f"  WARNING: Usuario '{fragment}' no encontrado")
        continue
    ph, pa = scores_for(canada_score, other_score)
    upsert_prediction(user, ph, pa)

# Sudáfrica-favor: Santiago Magaña — find him by full name
for (fragment, canada_score, other_score) in SUDAFRICA_PREDICTIONS:
    # fragment = "Santiago Magaña", but Santiago Cobo also has "Santiago"
    # so match by "Magaña"
    user = find_user("Magaña")
    if not user:
        user = find_user("Magana")
    if not user:
        print(f"  WARNING: Santiago Magaña no encontrado")
        continue
    ph, pa = scores_for(canada_score, other_score)
    upsert_prediction(user, ph, pa)

db.commit()
print("\n✓ Correcciones aplicadas y guardadas en DB.")
db.close()
