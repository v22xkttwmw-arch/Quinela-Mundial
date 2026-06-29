#!/usr/bin/env python3
"""
import_knockouts.py — Importa partidos de eliminatoria desde API-Football a la BD.

Uso:
    railway run python scripts/import_knockouts.py
"""
import os, sys
from datetime import datetime

import httpx
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models

API_KEY = os.getenv("API_FOOTBALL_KEY", "")
HEADERS = {
    "x-apisports-key":  API_KEY,
    "x-apisports-host": "v3.football.api-sports.io",
}

_FINISHED = {"FT", "AET", "PEN", "FINISHED", "MATCH FINISHED"}
_LIVE     = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP", "IN_PLAY", "PAUSED"}


def main() -> None:
    if not API_KEY:
        print("ERROR: API_FOOTBALL_KEY no definida.")
        sys.exit(1)

    print("Consultando API-Football — todos los fixtures del Mundial 2026…")
    with httpx.Client(timeout=20) as client:
        resp = client.get(
            "https://v3.football.api-sports.io/fixtures",
            headers=HEADERS,
            params={"league": 1, "season": 2026},
        )
    resp.raise_for_status()
    all_fixtures = resp.json().get("response", [])
    print(f"  {len(all_fixtures)} fixtures recibidos de la API.")

    db = SessionLocal()
    created = updated = skipped = 0

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
            venue      = fix["fixture"].get("venue", {}).get("name")
            kickoff_raw = fix["fixture"]["date"]

            try:
                kickoff_dt = datetime.fromisoformat(kickoff_raw.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                kickoff_dt = datetime.utcnow()

            existing = db.query(models.Match).filter(models.Match.api_match_id == api_id).first()
            if existing:
                if status in _FINISHED and existing.status not in _FINISHED:
                    existing.status     = status
                    existing.home_score = home_score
                    existing.away_score = away_score
                    db.commit()
                    print(f"  ✓ ACTUALIZADO  {home_name} {home_score}-{away_score} {away_name} [{rnd}]")
                    updated += 1
                else:
                    skipped += 1
                continue

            new_match = models.Match(
                api_match_id = api_id,
                home_team    = home_name,
                away_team    = away_name,
                status       = status if status in _FINISHED | _LIVE else "NS",
                home_score   = home_score if status in _FINISHED | _LIVE else None,
                away_score   = away_score if status in _FINISHED | _LIVE else None,
                kickoff_time = kickoff_dt,
                round        = rnd,
                venue        = venue,
            )
            db.add(new_match)
            db.commit()
            db.refresh(new_match)
            print(f"  + CREADO       {home_name} vs {away_name} [{rnd}]  status={new_match.status}")
            created += 1

    finally:
        db.close()

    print(f"\nResumen: {created} creados · {updated} actualizados · {skipped} ya existían sin cambios.")


if __name__ == "__main__":
    main()
