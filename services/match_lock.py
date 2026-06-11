"""Regla única de bloqueo de picks: 15 minutos antes del kickoff."""
from datetime import datetime, timedelta, timezone

LOCK_WINDOW_MINUTES = 15


def is_locked(kickoff_time: datetime, minutes: int = LOCK_WINDOW_MINUTES) -> bool:
    """True si ahora >= kickoff - `minutes`, sin importar zona horaria del valor recibido."""
    kickoff_utc = kickoff_time.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) >= kickoff_utc - timedelta(minutes=minutes)
