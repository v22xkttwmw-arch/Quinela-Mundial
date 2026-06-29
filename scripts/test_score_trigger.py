"""
Test script: migra knockout_scores de los 6 usuarios de prueba al esquema
de api_match_id numérico, setea SA vs Canada como FT 1-2 y verifica x2.

Run via: DATABASE_URL=... python3 scripts/test_score_trigger.py
     or: railway run python3 scripts/test_score_trigger.py  (con tunnel)
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Match, User, ClassicPrediction
from services.scoring import compute_live_classic_score, normalize_team_name, PHASE_MULTIPLIERS, base_points, _phase_from_slot_id
from main import TEAM_TRANSLATIONS

db = SessionLocal()

# ─── 1. Partido SA vs Canada ─────────────────────────────────────────────────
API_MATCH_ID = 1561329
SLOT_KEY     = str(API_MATCH_ID)   # "1561329"
REAL_HOME    = 1   # South Africa
REAL_AWAY    = 2   # Canada

match = db.query(Match).filter(Match.api_match_id == API_MATCH_ID).first()
if not match:
    print(f"ERROR: Partido api_match_id={API_MATCH_ID} no encontrado en DB")
    db.close(); sys.exit(1)

print(f"Partido: {match.home_team} vs {match.away_team}  (id={match.id}, api={match.api_match_id})")
print(f"Estado previo: status={match.status}, score={match.home_score}-{match.away_score}")

# Fijar resultado real para el test
match.status     = "FT"
match.home_score = REAL_HOME
match.away_score = REAL_AWAY
db.commit()
print(f"→ Seteado: FT {REAL_HOME}-{REAL_AWAY} (SA gana={REAL_HOME>REAL_AWAY}, Canada gana={REAL_AWAY>REAL_HOME})\n")

# ─── 2. Predicciones objetivo (SA home, Canada away) ─────────────────────────
TARGET_PREDS = {
    "gerardo magana":  {"homeScore": 1, "awayScore": 2},   # Canada 2-1  ← EXACTO
    "Imanol Martinez": {"homeScore": 0, "awayScore": 2},   # Canada 2-0  ← tendencia
    "Fernando Lopez":  {"homeScore": 1, "awayScore": 3},   # Canada 3-1  ← tendencia
    "Sebas Miranda":   {"homeScore": 1, "awayScore": 2},   # Canada 2-1  ← EXACTO
    "Santiago Cobo":   {"homeScore": 0, "awayScore": 2},   # Canada 2-0  ← tendencia
    "Santiago Magana": {"homeScore": 2, "awayScore": 1},   # SA 2-1      ← fallo
}

def find_user(name_fragment: str):
    nl = name_fragment.lower()
    return next((u for u in db.query(User).all() if nl in (u.name or "").lower()), None)

# ─── 3. Migrar ClassicPrediction.knockout_scores con llave numérica ───────────
print("=== Migrando ClassicPrediction.knockout_scores ===")
for name_frag, pred in TARGET_PREDS.items():
    user = find_user(name_frag)
    if not user:
        print(f"  WARN: usuario '{name_frag}' no encontrado"); continue

    cp = db.query(ClassicPrediction).filter_by(user_id=user.id).first()
    if not cp:
        cp = ClassicPrediction(
            user_id=user.id,
            group_fixtures="[]",
            knockout_scores="{}",
            selected_thirds="[]",
            third_assignments="{}",
            is_bracket_generated=False,
            captain_matches="[]",
            bracket_snapshot="{}",
        )
        db.add(cp)
        db.flush()
        print(f"  CREATED ClassicPrediction for {user.name}")

    ks = json.loads(cp.knockout_scores or "{}")
    ks[SLOT_KEY] = pred
    cp.knockout_scores = json.dumps(ks)
    print(f"  {user.name}: knockout_scores[\"{SLOT_KEY}\"] = {pred}")

db.commit()
print()

# ─── 4. Construir match_by_teams lookup (igual que main.py) ──────────────────
_FINISHED = {"FT", "AET", "PEN", "FINISHED", "AWARDED"}
_LIVE     = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP", "IN_PLAY", "PAUSED"}

match_by_teams: dict[str, dict] = {}
for m in db.query(Match).all():
    if m.api_match_id is None: continue
    if m.status in (_FINISHED | _LIVE) and m.home_score is not None and m.away_score is not None:
        home_es = TEAM_TRANSLATIONS.get(m.home_team, m.home_team)
        away_es = TEAM_TRANSLATIONS.get(m.away_team, m.away_team)
        match_by_teams[str(m.api_match_id)] = {
            "home_score": m.home_score,
            "away_score": m.away_score,
            "status": m.status,
            "home_team": normalize_team_name(home_es),
            "away_team": normalize_team_name(away_es),
            "round": m.round or "",
        }

print(f"Match lookup: {len(match_by_teams)} partidos terminados/vivos")
if SLOT_KEY in match_by_teams:
    e = match_by_teams[SLOT_KEY]
    print(f"  SA vs Canada: {e['home_score']}-{e['away_score']} ({e['status']})\n")
else:
    print(f"  WARN: {SLOT_KEY} NO está en match_by_teams!\n")

# ─── 5. Calcular y mostrar puntos ────────────────────────────────────────────
print("=== Puntos por fase (multiplicador x2 para R32) ===")
print(f"{'Usuario':<20} {'Pronost.':<10} {'Result.':<10} {'Outcome':<12} {'Pts base':<10} {'x2':<6} {'Total'}")
print("-" * 80)

for name_frag in TARGET_PREDS:
    user = find_user(name_frag)
    if not user: continue

    cp = db.query(ClassicPrediction).filter_by(user_id=user.id).first()
    ks = json.loads(cp.knockout_scores or "{}")
    group = json.loads(cp.group_fixtures or "[]")
    snap  = json.loads(cp.bracket_snapshot or "{}")

    result = compute_live_classic_score(
        group_fixtures=group,
        knockout_scores=ks,
        bracket_snapshot=snap,
        match_by_teams=match_by_teams,
    )

    pred = ks.get(SLOT_KEY, {})
    ph, pa = pred.get("homeScore"), pred.get("awayScore")
    pts_base, outcome = base_points(ph, pa, REAL_HOME, REAL_AWAY) if ph is not None else (0, "sin dato")
    phase = _phase_from_slot_id(SLOT_KEY)
    mult  = PHASE_MULTIPLIERS.get(phase, 1)

    print(f"{user.name:<20} {ph}-{pa:<9} {REAL_HOME}-{REAL_AWAY:<9} {outcome:<12} {pts_base:<10} x{mult:<5} {pts_base * mult}  (total={result['total_points']})")

    # Persistir total en ClassicPrediction
    cp.total_points_classic = result["total_points"]
    cp.exact_count_classic  = result["exact_count"]

db.commit()
print("\n✓ Puntos persistidos en ClassicPrediction.total_points_classic")
db.close()
