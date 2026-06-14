"""
Motor de Puntuación — Modo Clásico Mundial 2026

Escala oficial 5/3/1/0 (única fuente de verdad para todo el backend):

  5 pts — Marcador Exacto:        aciertas el marcador de ambos equipos.
  3 pts — Ganador + Diferencia:   aciertas quién gana (o el empate) Y la
                                   diferencia de gol exacta, pero fallas el
                                   marcador exacto.
  1 pto — Tendencia:               aciertas quién gana o el empate, pero
                                   con una diferencia de gol distinta.
  0 pts — Fallo:                   fallas el ganador/empate.
"""
from __future__ import annotations
import re
import unicodedata
from typing import Optional

# ─── Constantes ───────────────────────────────────────────────────────────────

POINTS_EXACT      = 5   # marcador exacto
POINTS_DIFFERENCE = 3   # ganador/empate + misma diferencia de gol
POINTS_TENDENCY   = 1   # solo ganador/empate (tendencia)
POINTS_MISS       = 0
CHAMPION_BONUS    = 20

# Multiplicadores por fase (usa los prefijos de slot_id como clave)
PHASE_MULTIPLIERS: dict[str, int] = {
    "groups":        1,
    "round_of_32":   2,
    "round_of_16":   3,
    "quarterfinals": 4,
    "semifinals":    5,
    "third_place":   6,
    "final":         7,
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

def normalize_team_name(name: str) -> str:
    """
    Normaliza un nombre de equipo para cruces robustos entre el Frontend y
    API-Football: minúsculas, sin espacios al inicio/fin, sin acentos ni
    diacríticos (vía unicodedata) y con espacios múltiples colapsados a uno.
    """
    if not name:
        return ""
    text = unicodedata.normalize("NFKD", name)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text.strip().lower())
    return text


def _sign(h: int, a: int) -> str:
    """'H' si gana el local, 'A' si gana el visitante, 'D' si empatan."""
    return "H" if h > a else "A" if a > h else "D"


def _tendency(ph: int, pa: int, rh: int, ra: int) -> bool:
    """True si la tendencia (V/E/D) del pronóstico coincide con el resultado real."""
    return _sign(ph, pa) == _sign(rh, ra)


def _phase_from_slot_id(slot_id: str) -> str:
    """Deduce la fase a partir del prefijo del slot_id (ej. 'QF-2' → 'quarterfinals')."""
    prefix = slot_id.split("-")[0].upper() if "-" in slot_id else slot_id.upper()
    return _PREFIX_TO_PHASE.get(prefix, "round_of_32")


def base_points_from_outcome(
    pred_home: int, pred_away: int, real_home: int, real_away: int, winner_correct: bool,
) -> tuple[int, str]:
    """
    Cascada oficial 5/3/1/0 a partir de un veredicto de "ganador correcto"
    ya resuelto externamente (útil en eliminatorias decididas por penales,
    donde el ganador real no se deduce del marcador).
    """
    if pred_home == real_home and pred_away == real_away:
        return POINTS_EXACT, "exact"

    if not winner_correct:
        return POINTS_MISS, "miss"

    # Regla especial: si el usuario predijo 0-0 y el partido real terminó en
    # empate CON goles (ej. 1-1, 2-2), solo se otorga el punto de Tendencia,
    # no los 3 de Diferencia (la "diferencia de gol" de un 0-0 no es comparable).
    if pred_home == 0 and pred_away == 0 and real_home == real_away and real_home > 0:
        return POINTS_TENDENCY, "tendency"

    if (pred_home - pred_away) == (real_home - real_away):
        return POINTS_DIFFERENCE, "difference"

    return POINTS_TENDENCY, "tendency"


def base_points(pred_home: int, pred_away: int, real_home: int, real_away: int) -> tuple[int, str]:
    """
    Calcula el puntaje base (sin multiplicador de fase ni capitán) y el
    nombre del resultado, siguiendo la escala oficial 5/3/1/0. El
    "ganador correcto" se deduce directamente de la comparación de marcadores.
    """
    winner_correct = _tendency(pred_home, pred_away, real_home, real_away)
    return base_points_from_outcome(pred_home, pred_away, real_home, real_away, winner_correct)


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
    base, outcome = base_points(pred_home, pred_away, real_home, real_away)

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
    dict con total_points, exact_count, difference_count,
         tendency_count, miss_count, champion_bonus, effectiveness, match_details
    """
    total_points     = 0
    exact_count      = 0
    difference_count = 0
    tendency_count   = 0
    miss_count       = 0
    match_details    = []

    def _tally(outcome: str) -> None:
        nonlocal exact_count, difference_count, tendency_count, miss_count
        if outcome == "exact":
            exact_count += 1
        elif outcome == "difference":
            difference_count += 1
        elif outcome == "tendency":
            tendency_count += 1
        else:
            miss_count += 1

    # ── Grupos ────────────────────────────────────────────────────────────────
    real_lookup: dict[str, dict] = {}
    for r in real_group_results:
        if r.get("homeScore") is None or r.get("awayScore") is None:
            continue
        key = f"{normalize_team_name(r['homeTeam'])}|{normalize_team_name(r['awayTeam'])}"
        real_lookup[key] = r

    for fixture in group_fixtures:
        key = f"{normalize_team_name(fixture['homeTeam'])}|{normalize_team_name(fixture['awayTeam'])}"
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
        _tally(result["outcome"])

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
        _tally(result["outcome"])

        match_details.append({"match_id": slot_id, **result})

    # ── Bono de Campeón ───────────────────────────────────────────────────────
    champion_bonus = 0
    if predicted_champion and real_champion:
        if predicted_champion.strip().lower() == real_champion.strip().lower():
            champion_bonus = CHAMPION_BONUS
            total_points  += CHAMPION_BONUS

    # ── Efectividad ───────────────────────────────────────────────────────────
    scored = exact_count + difference_count + tendency_count + miss_count
    max_base = scored * POINTS_EXACT if scored else 1
    earned_base = (
        exact_count      * POINTS_EXACT
        + difference_count * POINTS_DIFFERENCE
        + tendency_count   * POINTS_TENDENCY
    )
    effectiveness = round(earned_base / max_base * 100, 1)

    return {
        "total_points":      total_points,
        "exact_count":       exact_count,
        "difference_count":  difference_count,
        "tendency_count":    tendency_count,
        "miss_count":        miss_count,
        "champion_bonus":    champion_bonus,
        "effectiveness":     effectiveness,
        "match_details":     match_details,
    }


# ─── Cálculo en vivo (leaderboard / perfil) ───────────────────────────────────

def compute_live_classic_score(
    group_fixtures:    list[dict],
    knockout_scores:   dict[str, dict],
    bracket_snapshot:  dict[str, dict],
    match_by_teams:    dict[tuple[str, str], dict],
) -> dict:
    """
    Calcula en vivo los puntos de una quiniela clásica cruzando los
    pronósticos guardados (group_fixtures / knockout_scores) con los
    resultados reales de `Match`, usando la escala oficial 5/3/1/0
    (sin multiplicador de fase ni capitán).

    `match_by_teams` mapea (normalize_team_name(home_team), normalize_team_name(away_team)) ->
    {"home_score": int|None, "away_score": int|None}.

    Los puntos base (5/3/1/0) se multiplican por el multiplicador de fase
    correspondiente (`PHASE_MULTIPLIERS`), según la escala oficial.
    """
    total_points         = 0
    exact_count          = 0
    diff_count           = 0
    tendency_count       = 0
    total_predictions    = 0
    finished_predictions = 0

    def _lookup(home: str, away: str) -> Optional[dict]:
        return match_by_teams.get((normalize_team_name(home), normalize_team_name(away)))

    def _tally(ph: int, pa: int, rh: int, ra: int, multiplier: int) -> None:
        nonlocal total_points, exact_count, diff_count, tendency_count
        pts, outcome = base_points(ph, pa, rh, ra)
        total_points += pts * multiplier
        if outcome == "exact":
            exact_count += 1
        elif outcome == "difference":
            diff_count += 1
        elif outcome == "tendency":
            tendency_count += 1

    groups_multiplier = PHASE_MULTIPLIERS["groups"]
    for fixture in group_fixtures:
        ph, pa = fixture.get("homeScore"), fixture.get("awayScore")
        if ph is None or pa is None:
            continue
        total_predictions += 1

        match = _lookup(fixture.get("homeTeam", ""), fixture.get("awayTeam", ""))
        if not match or match["home_score"] is None or match["away_score"] is None:
            continue
        finished_predictions += 1
        _tally(int(ph), int(pa), match["home_score"], match["away_score"], groups_multiplier)

    for slot_id, entry in knockout_scores.items():
        ph, pa = entry.get("homeScore"), entry.get("awayScore")
        if ph is None or pa is None:
            continue
        total_predictions += 1

        teams = bracket_snapshot.get(slot_id)
        if not teams:
            continue
        match = _lookup(teams.get("home", ""), teams.get("away", ""))
        if not match or match["home_score"] is None or match["away_score"] is None:
            continue
        finished_predictions += 1

        phase = _phase_from_slot_id(slot_id)
        multiplier = PHASE_MULTIPLIERS.get(phase, 1)
        _tally(int(ph), int(pa), match["home_score"], match["away_score"], multiplier)

    return {
        "total_points":         total_points,
        "exact_count":          exact_count,
        "diff_count":           diff_count,
        "tendency_count":       tendency_count,
        "total_predictions":    total_predictions,
        "finished_predictions": finished_predictions,
    }
