#!/usr/bin/env python3
"""
sync_db.py — Pobla group_name en los partidos de fase de grupos.

Llama a API-Football /standings (liga 1, temporada 2026), extrae la letra
oficial FIFA de cada equipo y actualiza directamente la BD.

Uso:
    railway run python sync_db.py
"""
import os
import sys

from dotenv import load_dotenv
load_dotenv()

import httpx
from database import SessionLocal
import models

API_KEY  = os.getenv("API_FOOTBALL_KEY", "")
HEADERS  = {
    "x-apisports-key":  API_KEY,
    "x-apisports-host": "v3.football.api-sports.io",
}


def fetch_group_map() -> dict[str, str]:
    """Devuelve {team_name: letra} p.ej. {"England": "C", "Mexico": "A", ...}"""
    with httpx.Client(timeout=20) as client:
        resp = client.get(
            "https://v3.football.api-sports.io/standings",
            headers=HEADERS,
            params={"league": 1, "season": 2026},
        )
        resp.raise_for_status()

    group_map: dict[str, str] = {}
    for league_entry in resp.json().get("response", []):
        for group in league_entry.get("league", {}).get("standings", []):
            for entry in group:
                name      = entry["team"]["name"]
                raw_group = entry.get("group", "")          # "Group A", "Group B", …
                letter    = raw_group.replace("Group ", "").strip()
                if name and letter and len(letter) == 1 and letter.isalpha():
                    group_map[name] = letter.upper()
    return group_map


def main() -> None:
    if not API_KEY:
        print("ERROR: API_FOOTBALL_KEY no está definida en el entorno.")
        sys.exit(1)

    print("Contactando API-Football /standings…")
    try:
        group_map = fetch_group_map()
    except httpx.HTTPError as exc:
        print(f"ERROR al llamar a la API: {exc}")
        sys.exit(1)

    if not group_map:
        print(
            "La API no devolvió datos de grupos.\n"
            "Posibles causas:\n"
            "  • El torneo aún no tiene standings publicados (pre-torneo).\n"
            "  • La API key no tiene acceso al league 1 temporada 2026.\n"
            "Verifica en: https://v3.football.api-sports.io/standings?league=1&season=2026"
        )
        sys.exit(1)

    print(f"  {len(group_map)} equipos encontrados:")
    for team, letter in sorted(group_map.items(), key=lambda x: (x[1], x[0])):
        print(f"    Grupo {letter}: {team}")

    db = SessionLocal()
    try:
        matches  = db.query(models.Match).all()
        updated  = 0
        skipped  = 0

        for match in matches:
            letter = group_map.get(match.home_team) or group_map.get(match.away_team)
            if letter:
                match.group_name = letter
                updated += 1
            else:
                skipped += 1   # partido eliminatorio o equipo no en standings

        db.commit()
        print(f"\n✓  {updated} partidos actualizados con group_name.")
        if skipped:
            print(f"   {skipped} partidos sin grupo asignado (eliminatorios / datos ausentes).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
