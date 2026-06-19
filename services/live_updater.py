"""
Árbitro Automático — motor de sincronización de resultados en tiempo real
contra la API externa API-Football (https://v3.football.api-sports.io).
"""
import os
import logging
import asyncio
from datetime import date, datetime, timedelta

import httpx
from dotenv import load_dotenv
from sqlalchemy import func

from database import SessionLocal
import crud, models

load_dotenv()

logger = logging.getLogger(__name__)

SYNC_INTERVAL_SECONDS = 300

_API_BASE_URL = "https://v3.football.api-sports.io"

# Statuses de API-Football que indican que el partido ya terminó
# (90 min, prórroga o penaltis). Se incluyen alias largos como red de
# seguridad por si la API responde con el nombre completo en vez del código.
_FINISHED_STATUSES = {"FT", "AET", "PEN", "FINISHED", "MATCH FINISHED"}

# Statuses de API-Football que indican que el partido está en curso
_LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP", "IN_PLAY", "PAUSED"}

# Si un partido lleva más de este tiempo "en vivo" desde su kickoff sin que
# la API confirme su cierre, lo marcamos como terminado de todas formas para
# que no se quede congelado en el leaderboard.
_STALE_LIVE_MINUTES = 120


def _finish_match(db, match: models.Match, home_score: int, away_score: int, winning_team=None) -> None:
    """Marca un partido como finalizado (FT) y reparte los puntos de
    Quiniela Clásica, Supervivencia y Quiniela Clásica de eliminatorias."""
    crud.finish_match_and_calculate_points(
        db,
        match_id=match.id,
        home_score=home_score,
        away_score=away_score,
        winning_team=winning_team,
    )

    if match.round:
        crud.score_survival_picks(
            db,
            home_team=match.home_team,
            away_team=match.away_team,
            home_score=home_score,
            away_score=away_score,
            winning_team=winning_team,
            match_round=match.round,
        )

        if "Group Stage" not in match.round:
            crud.score_classic_knockout_match(
                db,
                home_team=match.home_team,
                away_team=match.away_team,
                home_score=home_score,
                away_score=away_score,
                winning_team=winning_team,
            )


async def fetch_and_update_matches() -> dict:
    """
    Consulta los partidos del día en API-Football. Por cada uno que ya
    terminó (FT/AET/PEN), localiza el partido correspondiente en nuestra
    BD por nombre de equipo (ignorando mayúsculas/minúsculas) y, si aún
    no estaba marcado como terminado, dispara
    crud.finish_match_and_calculate_points() para repartir los puntos
    (Exacto / Tendencia / Fallo) a todos los usuarios que lo predijeron.
    """
    headers = {
        "x-apisports-key": os.getenv("API_FOOTBALL_KEY"),
        "x-apisports-host": "v3.football.api-sports.io",
    }
    params = {"date": date.today().strftime("%Y-%m-%d")}

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{_API_BASE_URL}/fixtures", headers=headers, params=params)
    response.raise_for_status()

    fixtures = response.json().get("response", [])
    updated = []

    db = SessionLocal()
    try:
        for fixture in fixtures:
            api_status = fixture["fixture"]["status"]["short"]
            if api_status not in _FINISHED_STATUSES and api_status not in _LIVE_STATUSES:
                continue

            api_fixture_id = fixture["fixture"]["id"]
            home_name  = fixture["teams"]["home"]["name"]
            away_name  = fixture["teams"]["away"]["name"]
            home_score = fixture["goals"]["home"]
            away_score = fixture["goals"]["away"]

            # Para partidos decididos por penales el marcador queda empatado;
            # extraemos el ganador real del campo winner de la API.
            winning_team = None
            if api_status == "PEN":
                if fixture["teams"]["home"].get("winner") is True:
                    winning_team = home_name
                elif fixture["teams"]["away"].get("winner") is True:
                    winning_team = away_name

            # Buscar primero por api_match_id (evita fallos por nombres de equipo
            # que difieren entre la API y nuestra BD, ej. "Czechia" vs "Czech Republic").
            match = (
                db.query(models.Match)
                .filter(models.Match.api_match_id == api_fixture_id)
                .first()
            )
            if not match:
                # Fallback a búsqueda por nombre para partidos sin api_match_id.
                match = (
                    db.query(models.Match)
                    .filter(
                        func.lower(models.Match.home_team) == home_name.strip().lower(),
                        func.lower(models.Match.away_team) == away_name.strip().lower(),
                    )
                    .first()
                )
            if not match or match.status == "FT":
                continue  # no existe en nuestra BD o ya finalizado

            if api_status in _LIVE_STATUSES:
                # Partido en curso: refrescamos marcador/status para el leaderboard en vivo,
                # sin disparar el reparto de puntos definitivo.
                if match.status != api_status or match.home_score != home_score or match.away_score != away_score:
                    match.status = api_status
                    match.home_score = home_score
                    match.away_score = away_score
                    db.commit()
                    updated.append(match.id)
                continue

            # api_status indica que el partido ya terminó (FT/AET/PEN/...)
            _finish_match(db, match, home_score, away_score, winning_team)
            updated.append(match.id)
            logger.info(
                "Árbitro Automático: %s %s-%s %s [%s] finalizado — puntos calculados",
                home_name, home_score, away_score, away_name, api_status,
            )

        # Red de seguridad: partidos que llevan demasiado tiempo "en vivo" sin
        # que la API confirme su cierre (ej. desaparecieron del feed del día).
        stale_cutoff = datetime.utcnow() - timedelta(minutes=_STALE_LIVE_MINUTES)
        stale_matches = (
            db.query(models.Match)
            .filter(models.Match.status.in_(_LIVE_STATUSES), models.Match.kickoff_time < stale_cutoff)
            .all()
        )
        for match in stale_matches:
            if match.id in updated:
                continue

            # Intentar obtener el marcador real de la API antes de cerrar el partido.
            # Esto evita terminar con 0-0 cuando el gol fue en tiempo agregado y el
            # ciclo de sync no lo capturó a tiempo.
            final_home = match.home_score or 0
            final_away = match.away_score or 0
            stale_winner = None

            if match.api_match_id:
                try:
                    async with httpx.AsyncClient(timeout=10) as stale_client:
                        stale_resp = await stale_client.get(
                            f"{_API_BASE_URL}/fixtures",
                            headers=headers,
                            params={"id": match.api_match_id},
                        )
                    stale_resp.raise_for_status()
                    stale_fixtures = stale_resp.json().get("response", [])
                    if stale_fixtures:
                        sf = stale_fixtures[0]
                        if sf["goals"]["home"] is not None:
                            final_home = sf["goals"]["home"]
                        if sf["goals"]["away"] is not None:
                            final_away = sf["goals"]["away"]
                        sf_status = sf["fixture"]["status"]["short"]
                        if sf_status == "PEN":
                            if sf["teams"]["home"].get("winner") is True:
                                stale_winner = sf["teams"]["home"]["name"]
                            elif sf["teams"]["away"].get("winner") is True:
                                stale_winner = sf["teams"]["away"]["name"]
                except Exception:
                    logger.warning(
                        "Árbitro Automático: no se pudo consultar API para partido estancado %d (%s vs %s) — usando marcador en BD",
                        match.id, match.home_team, match.away_team,
                    )

            _finish_match(db, match, final_home, final_away, stale_winner)
            updated.append(match.id)
            logger.warning(
                "Árbitro Automático: %s vs %s lleva más de %d min en vivo sin actualización — forzado a finalizado (%d-%d)",
                match.home_team, match.away_team, _STALE_LIVE_MINUTES, final_home, final_away,
            )
    finally:
        db.close()

    return {"checked": len(fixtures), "updated": updated}


_MAX_CONSECUTIVE_ERRORS = 5
_CIRCUIT_BREAKER_SLEEP = 3600  # 1 hora — protege la cuota de API-Football


async def start_live_updater_loop() -> None:
    """Bucle en segundo plano: ejecuta fetch_and_update_matches() cada 300s.

    Circuit breaker: si ocurren 5 errores consecutivos, pausa 1 hora antes de
    reintentar, protegiendo así la cuota mensual de API-Football.
    """
    consecutive_errors = 0
    while True:
        try:
            await fetch_and_update_matches()
            consecutive_errors = 0
        except Exception:
            logger.exception("Árbitro Automático: error durante la sincronización")
            consecutive_errors += 1
            if consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
                logger.error(
                    "Árbitro Automático: %d errores consecutivos — circuit breaker activado, pausa %ds",
                    consecutive_errors,
                    _CIRCUIT_BREAKER_SLEEP,
                )
                await asyncio.sleep(_CIRCUIT_BREAKER_SLEEP)
                consecutive_errors = 0
                continue
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)
