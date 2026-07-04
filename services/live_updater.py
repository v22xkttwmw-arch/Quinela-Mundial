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
                match_round=match.round,
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

    # Enriquecer con partidos NS del pasado que la API no incluyó hoy
    # (partidos que se jugaron en días anteriores pero quedaron sin actualizar).
    # Los consultamos individualmente para no desperdiciar cuota.
    db_catchup = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=3)
        unfinished = (
            db_catchup.query(models.Match)
            .filter(
                models.Match.status.notin_(["FT", "AET", "PEN"]),
                models.Match.kickoff_time < cutoff,
                models.Match.api_match_id.isnot(None),
            )
            .all()
        )
    finally:
        db_catchup.close()

    already_in_feed = {f["fixture"]["id"] for f in fixtures}
    async with httpx.AsyncClient(timeout=10) as client:
        for m in unfinished:
            if m.api_match_id in already_in_feed:
                continue
            try:
                r = await client.get(
                    f"{_API_BASE_URL}/fixtures",
                    headers=headers,
                    params={"id": m.api_match_id},
                )
                r.raise_for_status()
                extra = r.json().get("response", [])
                if extra:
                    fixtures.append(extra[0])
                    already_in_feed.add(m.api_match_id)
            except Exception:
                logger.warning("Árbitro Automático: no se pudo consultar API para partido NS pasado %d", m.api_match_id)
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


async def import_knockout_matches() -> dict:
    """
    Importa todos los partidos de eliminatoria (no-Group Stage) de la
    API-Football al torneo 2026 que no existan todavía en la BD.

    Llamar desde /admin/import-knockouts tras terminar la fase de grupos
    para poblar los cruces de R32 (y superiores conforme avance el torneo).
    """
    headers = {
        "x-apisports-key": os.getenv("API_FOOTBALL_KEY"),
        "x-apisports-host": "v3.football.api-sports.io",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{_API_BASE_URL}/fixtures",
            headers=headers,
            params={"league": 1, "season": 2026},
        )
    resp.raise_for_status()
    all_fixtures = resp.json().get("response", [])

    db = SessionLocal()
    created = []
    skipped = []

    try:
        for fix in all_fixtures:
            rnd = fix.get("league", {}).get("round", "") or ""
            if "group" in rnd.lower():
                continue  # solo eliminatorias

            api_id     = fix["fixture"]["id"]
            home_name  = fix["teams"]["home"]["name"]
            away_name  = fix["teams"]["away"]["name"]
            status     = fix["fixture"]["status"]["short"]
            home_score = fix["goals"]["home"]
            away_score = fix["goals"]["away"]
            kickoff_raw = fix["fixture"]["date"]   # ISO 8601
            venue      = fix["fixture"].get("venue", {}).get("name")

            try:
                kickoff_dt = datetime.fromisoformat(kickoff_raw.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                kickoff_dt = datetime.utcnow()

            # Si ya existe en la BD, solo actualiza el score si terminó
            existing = db.query(models.Match).filter(models.Match.api_match_id == api_id).first()
            if existing:
                if status in _FINISHED_STATUSES and existing.status not in _FINISHED_STATUSES:
                    winning_team = None
                    if status == "PEN":
                        if fix["teams"]["home"].get("winner") is True:
                            winning_team = home_name
                        elif fix["teams"]["away"].get("winner") is True:
                            winning_team = away_name
                    _finish_match(db, existing, home_score or 0, away_score or 0, winning_team)
                    skipped.append(f"updated: {home_name} vs {away_name}")
                else:
                    skipped.append(f"already exists: {home_name} vs {away_name}")
                continue

            new_match = models.Match(
                api_match_id=api_id,
                home_team=home_name,
                away_team=away_name,
                status=status if status in _FINISHED_STATUSES | _LIVE_STATUSES else "NS",
                home_score=home_score,
                away_score=away_score,
                kickoff_time=kickoff_dt,
                round=rnd,
                venue=venue,
            )
            db.add(new_match)
            db.flush()

            # Si ya terminó, calcular puntos inmediatamente
            if status in _FINISHED_STATUSES and home_score is not None and away_score is not None:
                winning_team = None
                if status == "PEN":
                    if fix["teams"]["home"].get("winner") is True:
                        winning_team = home_name
                    elif fix["teams"]["away"].get("winner") is True:
                        winning_team = away_name
                _finish_match(db, new_match, home_score, away_score, winning_team)

            created.append(f"{home_name} vs {away_name} [{rnd}]")
            logger.info("import_knockout: creado %s vs %s [%s]", home_name, away_name, rnd)

        db.commit()
    finally:
        db.close()

    return {"created": created, "skipped_or_updated": skipped, "total_created": len(created)}


async def catchup_past_matches() -> dict:
    """
    Consulta la API-Football por cada partido con status distinto de FT/AET/PEN
    cuyo kickoff ya pasó y lo cierra con el resultado real.

    Diseñado para ejecutarse una sola vez (vía /admin/catchup) después de
    períodos sin conectividad o cuando el loop diario dejó partidos sin cerrar.
    """
    headers = {
        "x-apisports-key": os.getenv("API_FOOTBALL_KEY"),
        "x-apisports-host": "v3.football.api-sports.io",
    }

    db = SessionLocal()
    fixed = []
    errors = []

    try:
        cutoff = datetime.utcnow() - timedelta(hours=3)
        unfinished = (
            db.query(models.Match)
            .filter(
                models.Match.status.notin_(["FT", "AET", "PEN"]),
                models.Match.kickoff_time < cutoff,
                models.Match.api_match_id.isnot(None),
            )
            .all()
        )

        async with httpx.AsyncClient(timeout=10) as client:
            for match in unfinished:
                try:
                    resp = await client.get(
                        f"{_API_BASE_URL}/fixtures",
                        headers=headers,
                        params={"id": match.api_match_id},
                    )
                    resp.raise_for_status()
                    results = resp.json().get("response", [])
                    if not results:
                        continue

                    fix = results[0]
                    api_status  = fix["fixture"]["status"]["short"]
                    home_score  = fix["goals"]["home"]
                    away_score  = fix["goals"]["away"]

                    if api_status not in _FINISHED_STATUSES:
                        continue
                    if home_score is None or away_score is None:
                        continue

                    winning_team = None
                    if api_status == "PEN":
                        if fix["teams"]["home"].get("winner") is True:
                            winning_team = fix["teams"]["home"]["name"]
                        elif fix["teams"]["away"].get("winner") is True:
                            winning_team = fix["teams"]["away"]["name"]

                    _finish_match(db, match, home_score, away_score, winning_team)
                    fixed.append({
                        "match_id": match.id,
                        "teams": f"{match.home_team} vs {match.away_team}",
                        "score": f"{home_score}-{away_score}",
                        "status": api_status,
                    })
                    logger.info(
                        "Catchup: %s vs %s → %d-%d [%s]",
                        match.home_team, match.away_team, home_score, away_score, api_status,
                    )
                except Exception as e:
                    errors.append({"api_match_id": match.api_match_id, "error": str(e)})
                    logger.warning("Catchup: error en partido api_id=%d — %s", match.api_match_id, e)
    finally:
        db.close()

    return {"fixed": fixed, "errors": errors, "total_fixed": len(fixed)}


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
