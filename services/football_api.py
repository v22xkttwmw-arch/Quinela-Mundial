import os
import requests
from dotenv import load_dotenv

load_dotenv()

_API_KEY = os.getenv("API_FOOTBALL_KEY")
_BASE_URL = "https://v3.football.api-sports.io"
LEAGUE_ID = int(os.getenv("API_FOOTBALL_LEAGUE_ID", "1"))
SEASON = int(os.getenv("API_FOOTBALL_SEASON", "2026"))

# Statuses que API-Football reporta como "partido terminado en 90 min"
# Para fases de eliminatoria añadir AET (prórroga) y PEN (penaltis) según reglas de la quiniela
_FINISHED_STATUSES = "FT"


def _headers() -> dict:
    return {"x-apisports-key": _API_KEY}


def _check_configured():
    if not _API_KEY or _API_KEY == "REPLACE_ME":
        raise ValueError("API_FOOTBALL_KEY no está configurada en .env")


def get_fixtures(status: str) -> list:
    """
    Llama a /fixtures con los filtros de liga, temporada y status.
    Devuelve la lista cruda 'response' del JSON de API-Football.
    Lanza ValueError si la clave no está configurada.
    Lanza requests.HTTPError si la API devuelve un error HTTP.
    Lanza RuntimeError si la API devuelve errores en el cuerpo (clave inválida, límite alcanzado).
    """
    _check_configured()

    resp = requests.get(
        f"{_BASE_URL}/fixtures",
        headers=_headers(),
        params={"league": LEAGUE_ID, "season": SEASON, "status": status},
        timeout=10,
    )
    resp.raise_for_status()

    data = resp.json()
    api_errors = data.get("errors", {})
    if api_errors:
        raise RuntimeError(f"Error de API-Football: {api_errors}")

    return data.get("response", [])


def get_upcoming_fixtures() -> list:
    """Partidos aún no empezados (NS = Not Started)."""
    return get_fixtures("NS")


def get_finished_fixtures() -> list:
    """Partidos finalizados en tiempo reglamentario."""
    return get_fixtures(_FINISHED_STATUSES)


def parse_fixture(fixture: dict) -> dict:
    """
    Extrae los campos que necesita nuestra BD de un objeto fixture crudo.
    Devuelve un dict con claves: api_match_id, home_team, away_team,
    kickoff_time (datetime UTC naive), status, home_score, away_score.
    """
    from datetime import datetime, timezone

    raw_date = fixture["fixture"]["date"]
    kickoff = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
    kickoff_utc = kickoff.astimezone(timezone.utc).replace(tzinfo=None)

    return {
        "api_match_id": fixture["fixture"]["id"],
        "home_team": fixture["teams"]["home"]["name"],
        "away_team": fixture["teams"]["away"]["name"],
        "kickoff_time": kickoff_utc,
        "status": fixture["fixture"]["status"]["short"],
        "elapsed": fixture["fixture"]["status"].get("elapsed"),
        "home_score": fixture["goals"]["home"],
        "away_score": fixture["goals"]["away"],
    }
