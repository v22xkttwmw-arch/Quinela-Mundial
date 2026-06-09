#!/usr/bin/env python3
"""
Activa el plan de un usuario directamente en la BD — sin JWT.

Uso:
    python activar_admin.py <email> <plan>

Planes válidos:
    classic   → activa has_paid_classic
    survival  → activa has_paid_survival
    complete  → activa ambos (classic + survival)

Ejemplos:
    python activar_admin.py juan@example.com classic
    python activar_admin.py maria@example.com complete
"""
import sys
import os
from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal
import models


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    plan  = sys.argv[2].strip().lower()

    if plan not in ("classic", "survival", "complete"):
        print(f"Error: plan '{plan}' no válido. Usa: classic | survival | complete")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"Error: no existe ningún usuario con email '{email}'")
            sys.exit(1)

        if plan in ("classic", "complete"):
            user.has_paid_classic = True
        if plan in ("survival", "complete"):
            user.has_paid_survival = True

        db.commit()
        db.refresh(user)

        print(f"✓  Plan '{plan}' activado para {user.email}")
        print(f"   has_paid_classic  = {user.has_paid_classic}")
        print(f"   has_paid_survival = {user.has_paid_survival}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
