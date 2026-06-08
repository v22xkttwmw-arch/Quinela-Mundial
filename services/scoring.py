"""
Motor de Puntuación — Modo Clásico Mundial 2026
"""
from __future__ import annotations
from typing import Optional

# ─── Constantes ───────────────────────────────────────────────────────────────

POINTS_EXACT     = 3
POINTS_TENDENCY  = 1
POINTS_MISS      = 0
CHAMPION_BONUS   = 20

# Multiplicadores por fase (usa los prefijos de slot_id como clave)
PHASE_MULTIPLIERS: dict[str, int] = {
    "groups":       1,
    "round_of_32":  2,
    "round_of_16":  2,
    "quarterfinals": 2,
    "semifinals":   3,
    "third_place":  3,
    "final":        4,
}

# Mapa de prefijos de ID → nombre de fase
_PREFIX_TO_PHASE: dict[str, str] = {
    "R32":   "round_of_32",
    "R16":   "round_of_16",
    "QF":    "quarterfinals",
    "SF":    "semifinals",
    "TP":    "third_place",
    "FINAL": "final",
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _tendency(ph: int, pa: int, rh: int, ra: int) -> bool:
    """True si la tendencia (V/E/D) del pronóstico coincide con el resultado real."""
    def sign(a: int, b: int) -> str:
        return "H" if a > b else "A" if b > a else "D"
    return sign(ph, pa) == sign(rh, ra)


def _phase_from_slot_id(slot_id: str) -> str:
    """Deduce la fase a partir del prefijo del slot_id (ej. 'QF-2' → 'quarterfinals')."""
    prefix = slot_id.split("-")[0].upper() if "-" in slot_id else slot_id.upper()
    return _PREFIX_TO_PHASE.get(prefix, "round_of_32")


# ─── Función principal ────────────────────────────────────────────────────────

def score_match(
    pred_home: int,
    pred_away: int,
    real_home: int,
    real_away: int,
    phase: str,
    is_captain: bool = False,
) -> dict:
    """Puntúa un partido individual y retorna el desglose."""
    if pred_home == real_home and pred_away == real_away:
        base   = POINTS_EXACT
        outcome = "exact"
    elif _tendency(pred_home, pred_away, real_home, real_away):
        base   = POINTS_TENDENCY
        outcome = "tendency"
    else:
        base   = POINTS_MISS
        outcome = "miss"

    multiplier = PHASE_MULTIPLIERS.get(phase, 1)
    points     = base * multiplier * (2 if is_captain else 1)

    return {
        "outcome":    outcome,
        "base":       base,
        "multiplier": multiplier,
        "captain":    is_captain,
        "points":     points,
    }


def calculate_user_score(
    group_fixtures:         list[dict],
    knockout_scores:        dict[str, dict],
    captain_matches:        list[str],
    real_group_results:     list[dict],
    real_knockout_results:  dict[str, dict],
    predicted_champion:     Optional[str] = None,
    real_champion:          Optional[str] = None,
) -> dict:
    """
    Calcula la puntuación total de una quiniela clásica.

    Parámetros
    ----------
    group_fixtures          : predicciones de fase de grupos (lista de fixtures del usuario)
    knockout_scores         : predicciones de fase eliminatoria  {slot_id: {homeScore, awayScore}}
    captain_matches         : IDs de partidos con capitán activo (×2)
    real_group_results      : resultados reales de grupos {homeTeam, awayTeam, homeScore, awayScore}
    real_knockout_results   : resultados reales de eliminatorias {slot_id: {homeScore, awayScore}}
    predicted_champion      : nombre del equipo campeón pronosticado
    real_champion           : nombre del campeón real (None si el torneo no ha terminado)

    Retorna
    -------
    dict con total_points, exact_count, tendency_count, miss_count,
         champion_bonus, effectiveness, match_details
    """
    total_points   = 0
    exact_count    = 0
    tendency_count = 0
    miss_count     = 0
    match_details  = []

    # ── Grupos ────────────────────────────────────────────────────────────────
    real_lookup: dict[str, dict] = {}
    for r in real_group_results:
        if r.get("homeScore") is None or r.get("awayScore") is None:
            continue
        key = f"{r['homeTeam'].strip().lower()}|{r['awayTeam'].strip().lower()}"
        real_lookup[key] = r

    for fixture in group_fixtures:
        key = f"{fixture['homeTeam'].strip().lower()}|{fixture['awayTeam'].strip().lower()}"
        real = real_lookup.get(key)
        if not real:
            continue

        ph = int(fixture.get("homeScore") or 0)
        pa = int(fixture.get("awayScore") or 0)
        rh = int(real["homeScore"])
        ra = int(real["awayScore"])

        is_cap = fixture["id"] in captain_matches
        result = score_match(ph, pa, rh, ra, "groups", is_cap)
        total_points += result["points"]

        if result["outcome"] == "exact":
            exact_count += 1
        elif result["outcome"] == "tendency":
            tendency_count += 1
        else:
            miss_count += 1

        match_details.append({"match_id": fixture["id"], **result})

    # ── Eliminatorias ─────────────────────────────────────────────────────────
    for slot_id, pred in knockout_scores.items():
        real = real_knockout_results.get(slot_id)
        if not real:
            continue

        rh = real.get("homeScore")
        ra = real.get("awayScore")
        if rh is None or ra is None:
            continue

        ph = int(pred.get("homeScore") or 0)
        pa = int(pred.get("awayScore") or 0)
        phase  = _phase_from_slot_id(slot_id)
        is_cap = slot_id in captain_matches

        result = score_match(ph, pa, int(rh), int(ra), phase, is_cap)
        total_points += result["points"]

        if result["outcome"] == "exact":
            exact_count += 1
        elif result["outcome"] == "tendency":
            tendency_count += 1
        else:
            miss_count += 1

        match_details.append({"match_id": slot_id, **result})

    # ── Bono de Campeón ───────────────────────────────────────────────────────
    champion_bonus = 0
    if predicted_champion and real_champion:
        if predicted_champion.strip().lower() == real_champion.strip().lower():
            champion_bonus = CHAMPION_BONUS
            total_points  += CHAMPION_BONUS

    # ── Efectividad ───────────────────────────────────────────────────────────
    scored = exact_count + tendency_count + miss_count
    max_base = scored * POINTS_EXACT if scored else 1
    effectiveness = round((exact_count * POINTS_EXACT + tendency_count * POINTS_TENDENCY) / max_base * 100, 1)

    return {
        "total_points":   total_points,
        "exact_count":    exact_count,
        "tendency_count": tendency_count,
        "miss_count":     miss_count,
        "champion_bonus": champion_bonus,
        "effectiveness":  effectiveness,
        "match_details":  match_details,
    }
