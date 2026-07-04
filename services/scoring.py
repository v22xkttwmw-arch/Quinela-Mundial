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


def round_str_to_phase(round_str: str) -> str:
    """Convierte el campo 'round' de la BD (ej. 'Round of 16') al nombre de fase interno."""
    r = (round_str or "").lower()
    if "32" in r:        return "round_of_32"
    if "16" in r:        return "round_of_16"
    if "quarter" in r:   return "quarterfinals"
    if "semi" in r:      return "semifinals"
    if "third" in r or "3rd" in r: return "third_place"
    if "final" in r:     return "final"
    return "round_of_32"

# Nombres en inglés (API-Football) → español (frontend/bracket_snapshot)
TEAM_TRANSLATIONS: dict[str, str] = {
    "Mexico": "México", "South Africa": "Sudáfrica", "South Korea": "Corea del Sur",
    "Czech Republic": "República Checa", "Canada": "Canadá",
    "Bosnia & Herzegovina": "Bosnia y Herzegovina",
    "Bosnia-Herzegovina": "Bosnia y Herzegovina",
    "Bosnia and Herzegovina": "Bosnia y Herzegovina",
    "Switzerland": "Suiza", "Brazil": "Brasil", "Scotland": "Escocia",
    "Morocco": "Marruecos", "Turkey": "Turquía", "Türkiye": "Turquía",
    "USA": "Estados Unidos", "Germany": "Alemania", "Ivory Coast": "Costa de Marfil",
    "Cote D'Ivoire": "Costa de Marfil", "Japan": "Japón", "Netherlands": "Países Bajos",
    "Sweden": "Suecia", "Tunisia": "Túnez", "Belgium": "Bélgica", "Egypt": "Egipto",
    "Iran": "Irán", "New Zealand": "Nueva Zelanda", "Saudi Arabia": "Arabia Saudita",
    "Cape Verde Islands": "Cabo Verde", "Cape Verde": "Cabo Verde",
    "Spain": "España", "France": "Francia", "Norway": "Noruega", "Jordan": "Jordania",
    "England": "Inglaterra", "Panama": "Panamá", "Uzbekistan": "Uzbekistán",
    "Algeria": "Argelia", "DR Congo": "RD Congo", "Congo DR": "RD Congo",
    "Haiti": "Haití", "Croatia": "Croacia", "Senegal": "Senegal", "Denmark": "Dinamarca",
    "Poland": "Polonia", "Peru": "Perú", "Wales": "Gales", "Cameroon": "Camerún",
    "Iraq": "Irak", "Curaçao": "Curazao", "Curacao": "Curazao",
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
    ya resuelto externamente.
    """
    if pred_home == real_home and pred_away == real_away:
        return POINTS_EXACT, "exact"

    if not winner_correct:
        return POINTS_MISS, "miss"

    if pred_home == 0 and pred_away == 0 and real_home == real_away and real_home > 0:
        return POINTS_TENDENCY, "tendency"

    if (pred_home - pred_away) == (real_home - real_away):
        return POINTS_DIFFERENCE, "difference"

    return POINTS_TENDENCY, "tendency"


def base_points(pred_home: int, pred_away: int, real_home: int, real_away: int) -> tuple[int, str]:
    """
    Calcula el puntaje base siguiendo la escala oficial 5/3/1/0 en 90 minutos.
    """
    winner_correct = _tendency(pred_home, pred_away, real_home, real_away)
    return base_points_from_outcome(pred_home, pred_away, real_home, real_away, winner_correct)


# ─── Nueva Lógica de Desempates ───────────────────────────────────────────────

def score_knockout_with_tiebreak(
    pred: dict,
    real: dict,
    phase: str,
    is_captain: bool = False,
) -> dict:
    """
    Puntúa un partido eliminatorio aplicando las reglas de desempate (AET/PEN).
    Para resultados sin empate en 90 min delega en la cascada estándar 5/3/1/0.
    """
    rh = int(real.get("home_score", real.get("homeScore")) or 0)
    ra = int(real.get("away_score", real.get("awayScore")) or 0)
    ph = int(pred.get("homeScore") or 0)
    pa = int(pred.get("awayScore") or 0)

    real_is_draw = (rh == ra)

    # 1. Si no hay empate en 90 min reales, se puntúa de forma normal.
    if not real_is_draw:
        base, outcome = base_points(ph, pa, rh, ra)

        # Si el usuario predijo empate y marcó a quién avanzaba en penales/TE,
        # y ese equipo terminó ganando en tiempo regular, se le reconoce el
        # acierto de tendencia (1 pto) en vez de fallo total, aunque el
        # partido nunca haya llegado a penales/TE.
        if outcome == "miss" and ph == pa and pred.get("penaltyWinner"):
            real_winner_side = "home" if rh > ra else "away"
            if pred.get("penaltyWinner") == real_winner_side:
                base, outcome = POINTS_TENDENCY, "tendency"
    
    # 2. Si el partido terminó en empate, aplicamos las reglas de eliminatoria
    else:
        # Extraer método y ganador de la realidad y de la predicción
        real_method = real.get("tieResolution") # "extraTime" | "penalties"
        real_winner = real.get("penaltyWinner") # "home" | "away"
        
        pred_is_draw = (ph == pa)

        if not pred_is_draw:
            # Predijo resultado claro, pero el real fue empate -> Fallo
            base, outcome = POINTS_MISS, "miss"
        elif not pred.get("tieResolution") or not pred.get("penaltyWinner"):
            # Predijo empate, pero se le olvidó marcar cómo se resolvía -> Tendencia de consuelo
            base, outcome = POINTS_TENDENCY, "tendency"
        else:
            pred_method = pred.get("tieResolution")
            pred_winner = pred.get("penaltyWinner")
            
            score_exact    = (ph == rh and pa == ra)
            winner_correct = (pred_winner == real_winner)
            method_correct = (pred_method == real_method)

            # CASO A: Se resolvió en Tiempo Extra (AET)
            if real_method == "extraTime":
                real_eth = real.get("extraTimeHome")
                real_eta = real.get("extraTimeAway")
                pred_eth = pred.get("extraTimeHome")
                pred_eta = pred.get("extraTimeAway")
                
                et_exact = (
                    real_eth is not None 
                    and pred_eth == real_eth 
                    and pred_eta == real_eta
                )

                if score_exact and method_correct and winner_correct and et_exact:
                    base, outcome = POINTS_EXACT, "exact"
                elif winner_correct and method_correct:
                    # Le atinó a ganador y a que fue en TE, pero falló algún marcador
                    base, outcome = POINTS_DIFFERENCE, "difference"
                else:
                    # Falló método o ganador, pero había puesto empate
                    base, outcome = POINTS_TENDENCY, "tendency"

            # CASO B: Se resolvió en Penales (PEN)
            else:
                if score_exact and method_correct and winner_correct:
                    base, outcome = POINTS_EXACT, "exact"
                elif winner_correct:
                    # En penales no hay goles exactos que sumar, si le atina al ganador 
                    # pero falla el método o el empate original, baja a Tendencia
                    base, outcome = POINTS_TENDENCY, "tendency"
                else:
                    base, outcome = POINTS_TENDENCY, "tendency"

    multiplier = PHASE_MULTIPLIERS.get(phase, 1)
    points = base * multiplier * (2 if is_captain else 1)

    return {
        "outcome":    outcome,
        "base":       base,
        "multiplier": multiplier,
        "captain":    is_captain,
        "points":     points,
    }


def score_match(
    pred_home: int,
    pred_away: int,
    real_home: int,
    real_away: int,
    phase: str,
    is_captain: bool = False,
) -> dict:
    """Wrapper legado para fase de grupos (no usa penales)."""
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

# ─── Funciones de Cálculo Global ──────────────────────────────────────────────

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
    Calcula la puntuación total de una quiniela clásica integrando Desempates.
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

    # ── Grupos
    group_results_by_id:   dict[str, dict] = {}
    group_results_by_name: dict[str, dict] = {}
    for r in real_group_results:
        if r.get("homeScore") is None or r.get("awayScore") is None:
            continue
        if r.get("id"):
            group_results_by_id[str(r["id"])] = r
        name_key = f"{normalize_team_name(r['homeTeam'])}|{normalize_team_name(r['awayTeam'])}"
        group_results_by_name[name_key] = r

    for fixture in group_fixtures:
        real = group_results_by_id.get(str(fixture.get("id", ""))) or \
               group_results_by_name.get(
                   f"{normalize_team_name(fixture['homeTeam'])}|{normalize_team_name(fixture['awayTeam'])}"
               )
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

    # ── Eliminatorias (Usando la nueva función con desempate)
    for slot_id, pred in knockout_scores.items():
        real = real_knockout_results.get(slot_id)
        if not real:
            continue

        rh = real.get("homeScore")
        ra = real.get("awayScore")
        if rh is None or ra is None:
            continue

        phase  = _phase_from_slot_id(slot_id)
        is_cap = slot_id in captain_matches

        # Pasamos el diccionario completo de predicción y realidad
        result = score_knockout_with_tiebreak(pred, real, phase, is_cap)
        
        total_points += result["points"]
        _tally(result["outcome"])
        match_details.append({"match_id": slot_id, **result})

    # ── Bono de Campeón
    champion_bonus = 0
    if predicted_champion and real_champion:
        if predicted_champion.strip().lower() == real_champion.strip().lower():
            champion_bonus = CHAMPION_BONUS
            total_points  += CHAMPION_BONUS

    # ── Efectividad
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


def compute_live_classic_score(
    group_fixtures: list[dict],
    knockout_scores: dict[str, dict],
    bracket_snapshot: dict[str, dict],
    match_by_teams: dict[str, dict],
) -> dict:
    """
    Calcula puntos en vivo para el leaderboard integrando Desempates.
    """
    total_points = 0
    exact_count = 0
    diff_count = 0
    tendency_count = 0
    total_predictions = 0
    finished_predictions = 0

    name_lookup: dict[tuple[str, str], dict] = {
        (e["home_team"], e["away_team"]): e
        for e in match_by_teams.values()
        if "home_team" in e and "away_team" in e
    }

    def _lookup_by_name(home: str, away: str) -> Optional[dict]:
        return name_lookup.get((normalize_team_name(home), normalize_team_name(away)))

    def _tally(result: dict) -> None:
        nonlocal total_points, exact_count, diff_count, tendency_count
        total_points += result["points"]
        if result["outcome"] == "exact":
            exact_count += 1
        elif result["outcome"] == "difference":
            diff_count += 1
        elif result["outcome"] == "tendency":
            tendency_count += 1

    # ── Grupos
    for fixture in group_fixtures:
        ph = fixture.get("homeScore")
        pa = fixture.get("awayScore")
        if ph is None or pa is None:
            continue

        total_predictions += 1
        match = _lookup_by_name(fixture.get("homeTeam", ""), fixture.get("awayTeam", ""))
        
        if not match or match["home_score"] is None or match["away_score"] is None:
            continue
            
        finished_predictions += 1
        result = score_match(int(ph), int(pa), match["home_score"], match["away_score"], "groups")
        _tally(result)

    # ── Eliminatorias (Usando la nueva función con desempate)
    for slot_id, pred in knockout_scores.items():
        if pred.get("homeScore") is None or pred.get("awayScore") is None:
            continue
            
        total_predictions += 1
        match = match_by_teams.get(slot_id)

        if not match:
            teams = bracket_snapshot.get(slot_id)
            if teams:
                match = _lookup_by_name(teams.get("home", ""), teams.get("away", ""))

        if not match or match.get("home_score") is None or match.get("away_score") is None:
            continue
            
        finished_predictions += 1
        phase = _phase_from_slot_id(slot_id)
        if match.get("round") and slot_id.replace("-", "").isdigit():
            phase = round_str_to_phase(match["round"])

        result = score_knockout_with_tiebreak(pred, match, phase)
        _tally(result)

    return {
        "total_points":         total_points,
        "exact_count":          exact_count,
        "diff_count":           diff_count,
        "tendency_count":       tendency_count,
        "total_predictions":    total_predictions,
        "finished_predictions": finished_predictions,
    }