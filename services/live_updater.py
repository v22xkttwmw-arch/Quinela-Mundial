"""
Árbitro Automático — motor de sincronización de resultados en tiempo real
contra la API externa API-Football (https://v3.football.api-sports.io).
"""
import os
import logging
import asyncio
from datetime import date

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
# (90 min, prórroga o penaltis)
_FINISHED_STATUSES = {"FT", "AET", "PEN"}

# Statuses de API-Football que indican que el partido está en curso
_LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"}


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

            match = (
                db.query(models.Match)
                .filter(
                    func.lower(models.Match.home_team) == home_name.strip().lower(),
                    func.lower(models.Match.away_team) == away_name.strip().lower(),
                )
                .first()
            )
            if not match or match.status in _FINISHED_STATUSES:
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

            crud.finish_match_and_calculate_points(
                db,
                match_id=match.id,
                home_score=home_score,
                away_score=away_score,
                winning_team=winning_team,
            )
            updated.append(match.id)
            logger.info(
                "Árbitro Automático: %s %s-%s %s [%s] finalizado — puntos calculados",
                home_name, home_score, away_score, away_name, api_status,
            )

            # Evaluar picks de Supervivencia (todas las fases)
            if match.round:
                n_surv = crud.score_survival_picks(
                    db,
                    home_team=home_name,
                    away_team=away_name,
                    home_score=home_score,
                    away_score=away_score,
                    winning_team=winning_team,
                    match_round=match.round,
                )
                if n_surv:
                    logger.info(
                        "Árbitro Automático: supervivencia evaluada %s vs %s — %d usuarios",
                        home_name, away_name, n_surv,
                    )

            # Para fases eliminatorias, evaluar también las quinielas clásicas
            if match.round and "Group Stage" not in match.round:
                n = crud.score_classic_knockout_match(
                    db,
                    home_team=home_name,
                    away_team=away_name,
                    home_score=home_score,
                    away_score=away_score,
                    winning_team=winning_team,
                )
                if n:
                    logger.info(
                        "Árbitro Automático: quinielas clásicas actualizadas para %s vs %s — %d usuarios",
                        home_name, away_name, n,
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
