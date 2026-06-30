"""
Inyección manual de picks para 4 partidos de ronda de 32.
Escribe en ClassicPrediction.knockout_scores (clave = str(api_match_id))
que es lo que lee _build_user_prediction_lookup en el daily_feed.

Ejecución: railway run python scripts/inject_picks_ronda32.py
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Match, User, ClassicPrediction
from datetime import datetime

db = SessionLocal()

# ── Helpers ────────────────────────────────────────────────────────────────

def find_match(variants_a, variants_b):
    """Busca el partido donde (home ≈ A y away ≈ B) o viceversa."""
    for va in variants_a:
        for vb in variants_b:
            m = db.query(Match).filter(
                Match.home_team.ilike(f'%{va}%'),
                Match.away_team.ilike(f'%{vb}%')
            ).first()
            if m:
                return m
            m = db.query(Match).filter(
                Match.home_team.ilike(f'%{vb}%'),
                Match.away_team.ilike(f'%{va}%')
            ).first()
            if m:
                return m
    return None


def find_user(all_users, *fragments):
    """Primer usuario cuyo nombre contenga TODOS los fragmentos (case-insensitive)."""
    for u in all_users:
        name = (u.name or u.email or '').lower()
        if all(f.lower() in name for f in fragments):
            return u
    return None


def upsert_pick(user, match, db_home_score, db_away_score):
    """Actualiza ClassicPrediction.knockout_scores con el pick del usuario."""
    if not match.api_match_id:
        print(f"  SKIP {user.name}: match sin api_match_id")
        return

    record = db.query(ClassicPrediction).filter_by(user_id=user.id).first()
    if not record:
        print(f"  SKIP {user.name}: sin registro ClassicPrediction en BD")
        return

    try:
        scores = json.loads(record.knockout_scores or '{}')
    except (TypeError, ValueError):
        scores = {}

    key = str(match.api_match_id)
    old = scores.get(key)
    scores[key] = {"homeScore": db_home_score, "awayScore": db_away_score}
    record.knockout_scores = json.dumps(scores)
    record.updated_at = datetime.utcnow()

    action = "UPDATED" if old else "CREATED"
    old_str = f"{old['homeScore']}-{old['awayScore']}" if old else "—"
    print(f"  {action}  {user.name:25s}  {match.home_team} {db_home_score}-{db_away_score} {match.away_team}  (antes: {old_str}, key={key})")


def apply_picks(match, stated_home_words, picks):
    """
    Aplica una lista de picks teniendo en cuenta quién es local en la BD.

    stated_home_words: palabras que identifican al equipo que el usuario llama "local"
                       en la notación del enunciado (ej. ["canada", "canad"]).
    picks: lista de (user, stated_home_score, stated_away_score)
           donde stated_home es el equipo mencionado primero en el enunciado.
    """
    if not match:
        return
    stated_home_is_db_home = any(w in match.home_team.lower() for w in stated_home_words)
    for user, sh, sa in picks:
        if user is None:
            continue
        if stated_home_is_db_home:
            upsert_pick(user, match, sh, sa)
        else:
            upsert_pick(user, match, sa, sh)


# ── Cargar usuarios ────────────────────────────────────────────────────────
all_users = db.query(User).all()
print(f"Usuarios en BD ({len(all_users)}):")
for u in all_users:
    print(f"  id={u.id:3d}  name='{u.name}'  email='{u.email}'")

u_imanol   = find_user(all_users, "Imanol")
u_fernando = find_user(all_users, "Fernando")
u_sebas    = find_user(all_users, "Sebastian") or find_user(all_users, "Miranda") or find_user(all_users, "Sebas")
u_cobo     = find_user(all_users, "Cobo")
u_santi_m  = find_user(all_users, "Santiago", "Magaña") or find_user(all_users, "Santiago", "Magana") or find_user(all_users, "Magaña")
u_gerardo  = find_user(all_users, "Gerardo")

print("\nUsuarios resueltos:")
for label, u in [
    ("Imanol Martinez",   u_imanol),
    ("Fernando Lopez",    u_fernando),
    ("Sebastian Miranda", u_sebas),
    ("Santiago Cobo",     u_cobo),
    ("Santiago Magaña",   u_santi_m),
    ("Gerardo Magaña",    u_gerardo),
]:
    status = f"✓  id={u.id}  '{u.name}'" if u else "✗  NO ENCONTRADO"
    print(f"  {label:22s}: {status}")

# ── Partido 1: Canadá vs Sudáfrica ────────────────────────────────────────
print("\n=== Partido 1: Canadá vs Sudáfrica ===")
m1 = find_match(["canada", "canad"], ["south africa", "sudafrica", "sudáfrica"])
if not m1:
    print("  ERROR: partido no encontrado — partidos disponibles:")
    for m in db.query(Match).all():
        print(f"    id={m.id} api={m.api_match_id}  {m.home_team} vs {m.away_team}")
else:
    print(f"  Encontrado: id={m1.id} api_match_id={m1.api_match_id}  {m1.home_team} vs {m1.away_team}")
    apply_picks(m1, ["canada", "canad"], [
        # (user,        canadá, sudáfrica)
        (u_imanol,      2, 0),
        (u_fernando,    3, 1),
        (u_sebas,       2, 1),
        (u_cobo,        2, 0),
        (u_santi_m,     1, 2),   # Santiago Magaña: Sudáfrica gana 2-1
    ])

# ── Partido 2: Brasil vs Japón ────────────────────────────────────────────
print("\n=== Partido 2: Brasil vs Japón ===")
m2 = find_match(["brazil", "brasil"], ["japan", "japon", "japón"])
if not m2:
    print("  ERROR: partido no encontrado")
else:
    print(f"  Encontrado: id={m2.id} api_match_id={m2.api_match_id}  {m2.home_team} vs {m2.away_team}")
    apply_picks(m2, ["brazil", "brasil"], [
        # (user,        brasil, japón)
        (u_sebas,       2, 1),
        (u_gerardo,     3, 1),
        (u_santi_m,     3, 2),
        (u_cobo,        2, 1),
    ])

# ── Partido 3: Alemania vs Paraguay ──────────────────────────────────────
print("\n=== Partido 3: Alemania vs Paraguay ===")
m3 = find_match(["germany", "alemania"], ["paraguay"])
if not m3:
    print("  ERROR: partido no encontrado")
else:
    print(f"  Encontrado: id={m3.id} api_match_id={m3.api_match_id}  {m3.home_team} vs {m3.away_team}")
    apply_picks(m3, ["germany", "alemania"], [
        # (user,        alemania, paraguay)
        (u_imanol,      2, 0),
        (u_sebas,       3, 0),
        (u_santi_m,     1, 2),   # Santiago Magaña: Paraguay gana 2-1
        (u_cobo,        3, 0),
    ])

# ── Partido 4: Marruecos vs Holanda ──────────────────────────────────────
print("\n=== Partido 4: Marruecos vs Holanda ===")
m4 = find_match(["morocco", "marruecos"], ["netherlands", "holland", "holanda", "países bajos"])
if not m4:
    print("  ERROR: partido no encontrado")
else:
    print(f"  Encontrado: id={m4.id} api_match_id={m4.api_match_id}  {m4.home_team} vs {m4.away_team}")
    apply_picks(m4, ["morocco", "marruecos"], [
        # (user,        marruecos, holanda)
        (u_sebas,       1, 0),
        (u_fernando,    0, 0),
    ])

# ── Guardar ───────────────────────────────────────────────────────────────
db.commit()
print("\n✓ Todas las predicciones guardadas en BD.")
db.close()
