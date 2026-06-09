"""
Sync WC 2026 fixtures from API-Football → updates venue, home_form, away_form
in the local quiniela.db. Run from project root inside the venv.
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env")

import httpx
from sqlalchemy import func
from database import SessionLocal
import models

API_KEY  = os.getenv("API_FOOTBALL_KEY")
HEADERS  = {
    "x-apisports-key":  API_KEY,
    "x-apisports-host": "v3.football.api-sports.io",
}

async def main():
    print("Conectando a API-Football…")
    async with httpx.AsyncClient(timeout=20) as client:
        fixtures_resp, standings_resp = await asyncio.gather(
            client.get("https://v3.football.api-sports.io/fixtures",
                       headers=HEADERS, params={"league": 1, "season": 2026}),
            client.get("https://v3.football.api-sports.io/standings",
                       headers=HEADERS, params={"league": 1, "season": 2026}),
        )

    fixtures_resp.raise_for_status()
    fixtures = fixtures_resp.json().get("response", [])
    print(f"  → {len(fixtures)} partidos recibidos")

    # Build form map from standings
    form_map: dict[str, str] = {}
    try:
        for entry in standings_resp.json().get("response", []):
            for group in entry.get("league", {}).get("standings", []):
                for row in group:
                    name = row["team"]["name"]
                    form = row.get("form") or ""
                    if name and form:
                        form_map[name] = form
    except Exception as e:
        print(f"  ⚠ No se pudo leer standings: {e}")
    print(f"  → {len(form_map)} equipos con racha de forma")

    db = SessionLocal()
    try:
        created = updated = 0
        for fx in fixtures:
            api_id       = fx["fixture"]["id"]
            kickoff_raw  = fx["fixture"]["date"]
            venue_name   = (fx["fixture"].get("venue") or {}).get("name") or ""
            round_name   = fx["league"]["round"]
            status_short = fx["fixture"]["status"]["short"]
            home_name    = fx["teams"]["home"]["name"]
            away_name    = fx["teams"]["away"]["name"]
            home_score   = (fx["goals"] or {}).get("home")
            away_score   = (fx["goals"] or {}).get("away")

            kickoff = (
                datetime.fromisoformat(kickoff_raw.replace("Z", "+00:00"))
                .astimezone(timezone.utc)
                .replace(tzinfo=None)
            )

            match = db.query(models.Match).filter(
                models.Match.api_match_id == api_id
            ).first()
            if not match:
                match = db.query(models.Match).filter(
                    func.lower(models.Match.home_team) == home_name.strip().lower(),
                    func.lower(models.Match.away_team) == away_name.strip().lower(),
                ).first()

            if match:
                match.api_match_id = api_id
                match.home_team    = home_name
                match.away_team    = away_name
                match.kickoff_time = kickoff
                match.round        = round_name
                match.venue        = venue_name
                match.status       = status_short
                match.home_score   = home_score
                match.away_score   = away_score
                match.home_form    = form_map.get(home_name)
                match.away_form    = form_map.get(away_name)
                updated += 1
            else:
                db.add(models.Match(
                    api_match_id = api_id,
                    home_team    = home_name,
                    away_team    = away_name,
                    kickoff_time = kickoff,
                    round        = round_name,
                    venue        = venue_name,
                    status       = status_short,
                    home_score   = home_score,
                    away_score   = away_score,
                    home_form    = form_map.get(home_name),
                    away_form    = form_map.get(away_name),
                ))
                created += 1

        db.commit()
        print(f"\n✓ Sync completo: {created} creados, {updated} actualizados")

        # Quick audit: how many have venue / form
        all_m = db.query(models.Match).all()
        with_venue = sum(1 for m in all_m if m.venue)
        with_form  = sum(1 for m in all_m if m.home_form)
        print(f"  → {with_venue}/{len(all_m)} partidos con estadio")
        print(f"  → {with_form}/{len(all_m)} partidos con racha de forma")

    finally:
        db.close()

asyncio.run(main())
