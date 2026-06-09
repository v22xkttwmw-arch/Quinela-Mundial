from sqlalchemy.orm import Session
from passlib.context import CryptContext
from typing import Optional
import json
import models, schemas
from services.scoring import base_points

def _update_leaderboard(db: Session, predictions: list):
    for pred in predictions:
        entry = db.query(models.Leaderboard).filter(models.Leaderboard.user_id == pred.user_id).first()
        if not entry:
            entry = models.Leaderboard(user_id=pred.user_id, total_points=0, exact_matches_count=0)
            db.add(entry)
        entry.total_points += pred.points_earned
        if pred.points_earned == 5:   # 5 = marcador exacto
            entry.exact_matches_count += 1

    db.flush()

    # Desempate: pts DESC → exactos DESC → fecha de registro ASC (cuenta más antigua gana)
    rows = (
        db.query(models.Leaderboard, models.User)
        .join(models.User, models.Leaderboard.user_id == models.User.id)
        .order_by(
            models.Leaderboard.total_points.desc(),
            models.Leaderboard.exact_matches_count.desc(),
            models.User.created_at.asc(),
        )
        .all()
    )

    current_rank = 1
    for i, (entry, user) in enumerate(rows):
        if i > 0:
            prev_entry, prev_user = rows[i - 1]
            if (
                entry.total_points      != prev_entry.total_points
                or entry.exact_matches_count != prev_entry.exact_matches_count
                or user.created_at      != prev_user.created_at
            ):
                current_rank = i + 1
        entry.rank_position = current_rank

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = pwd_context.hash(user.password)
    db_user = models.User(email=user.email, password_hash=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_prediction(db: Session, prediction: schemas.PredictionCreate, user_id: int):
    db_prediction = models.Prediction(
        user_id=user_id,
        match_id=prediction.match_id,
        predicted_home=prediction.predicted_home,
        predicted_away=prediction.predicted_away
    )
    db.add(db_prediction)
    db.commit()
    db.refresh(db_prediction)
    return db_prediction

def mark_user_as_paid(db: Session, user_id: int):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    db_user.is_paid = True
    db.commit()
    db.refresh(db_user)
    return db_user

def create_payment_record(db: Session, user_id: int, stripe_session_id: str, amount: float):
    payment = models.Payment(
        user_id=user_id,
        stripe_session_id=stripe_session_id,
        amount=amount,
        status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

def confirm_payment(db: Session, stripe_session_id: str):
    payment = db.query(models.Payment).filter(
        models.Payment.stripe_session_id == stripe_session_id
    ).first()
    if not payment or payment.status == "paid":
        return  # ya procesado o sesión desconocida — ignorar silenciosamente
    payment.status = "paid"
    user = db.query(models.User).filter(models.User.id == payment.user_id).first()
    if user:
        user.is_paid = True
    db.commit()

def create_match(db: Session, match: schemas.MatchCreate):
    db_match = models.Match(
        home_team=match.home_team,
        away_team=match.away_team,
        kickoff_time=match.kickoff_time
    )
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return db_match

def get_match_by_api_id(db: Session, api_match_id: int):
    return db.query(models.Match).filter(models.Match.api_match_id == api_match_id).first()

def upsert_match_from_api(db: Session, parsed: dict) -> bool:
    """Crea el partido si no existe. Devuelve True si fue creado."""
    existing = get_match_by_api_id(db, parsed["api_match_id"])
    if existing:
        return False
    db_match = models.Match(
        api_match_id=parsed["api_match_id"],
        home_team=parsed["home_team"],
        away_team=parsed["away_team"],
        kickoff_time=parsed["kickoff_time"],
        status=parsed["status"],
        elapsed=parsed.get("elapsed"),
    )
    db.add(db_match)
    db.commit()
    return True

def update_live_match(db: Session, match: models.Match, parsed: dict) -> None:
    """Actualiza status y minuto para partidos en vivo."""
    match.status = parsed["status"]
    match.elapsed = parsed.get("elapsed")
    if parsed.get("home_score") is not None:
        match.home_score = parsed["home_score"]
    if parsed.get("away_score") is not None:
        match.away_score = parsed["away_score"]
    db.commit()

def finish_match_and_calculate_points(
    db: Session,
    match_id: int,
    home_score: int,
    away_score: int,
    winning_team: Optional[str] = None,
):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        return None

    match.home_score = home_score
    match.away_score = away_score
    match.status = "FT"

    if home_score > away_score:
        derived_winner = match.home_team
    elif away_score > home_score:
        derived_winner = match.away_team
    else:
        derived_winner = None

    # winning_team explícito tiene prioridad; si no se pasa, se deriva del marcador
    effective_winner = winning_team if winning_team is not None else derived_winner

    # --- Clásico: Predicciones ---
    # Escala oficial 5/3/2/1/0 (services.scoring.base_points es la única
    # fuente de verdad para el cálculo de puntos del Modo Clásico).
    predictions = db.query(models.Prediction).filter(models.Prediction.match_id == match_id).all()
    for pred in predictions:
        points, outcome = base_points(pred.predicted_home, pred.predicted_away, home_score, away_score)

        pred.points_earned   = points
        pred.exact_points    = points if outcome == "exact" else 0
        pred.tendency_points = points if outcome != "exact" else 0

        # Actualizar total_points en User directamente
        user = db.query(models.User).filter(models.User.id == pred.user_id).first()
        if user:
            user.total_points += pred.points_earned

    # --- Survivor: SurvivorPicks ---
    picks = db.query(models.SurvivorPick).filter(models.SurvivorPick.match_id == match_id).all()
    for pick in picks:
        if effective_winner is not None and pick.team_id == effective_winner:
            pick.is_correct = True
        else:
            pick.is_correct = False
            # Eliminar al usuario del survivor global
            user = db.query(models.User).filter(models.User.id == pick.user_id).first()
            if user:
                user.is_alive = False
            # Compatibilidad: también actualizar GroupMember si el pick tiene grupo
            if pick.group_id is not None:
                membership = db.query(models.GroupMember).filter(
                    models.GroupMember.user_id == pick.user_id,
                    models.GroupMember.group_id == pick.group_id,
                ).first()
                if membership:
                    membership.is_alive = False

    _update_leaderboard(db, predictions)
    db.commit()
    db.refresh(match)
    return match


_ROUND_TO_JORNADA: dict[str, int] = {
    "group stage - 1": 1,
    "group stage - 2": 2,
    "group stage - 3": 3,
    "round of 32":     4,
    "round of 16":     5,
    "quarter-finals":  6,
    "semi-finals":     7,
    "final":           8,
}


def score_survival_picks(
    db: Session,
    home_team: str,
    away_team: str,
    home_score: int,
    away_score: int,
    winning_team: Optional[str],
    match_round: Optional[str],
) -> int:
    """
    Evalúa todos los picks de supervivencia activos para un partido recién finalizado.

    Regla: GANAR mantiene vivo al usuario. EMPATAR o PERDER lo elimina.
    Retorna el número de registros actualizados.
    """
    jornada_id = _ROUND_TO_JORNADA.get((match_round or "").strip().lower())
    if jornada_id is None:
        return 0

    # Determinar resultado por equipo
    if winning_team is not None:
        # Partidos decididos por penales: ganador explícito
        ht = home_team.strip().lower()
        wt = winning_team.strip().lower()
        home_outcome = "won" if wt == ht else "lost"
        away_outcome = "won" if wt != ht else "lost"
    elif home_score > away_score:
        home_outcome, away_outcome = "won",  "lost"
    elif away_score > home_score:
        home_outcome, away_outcome = "lost", "won"
    else:
        home_outcome, away_outcome = "lost", "lost"  # empate → ambos eliminados

    team_outcomes: dict[str, str] = {
        home_team.strip().lower(): home_outcome,
        away_team.strip().lower(): away_outcome,
    }

    records = db.query(models.SurvivalPrediction).filter(
        models.SurvivalPrediction.status == "alive"
    ).all()

    updated = 0
    jornada_str = str(jornada_id)

    for record in records:
        picks        = json.loads(record.picks        or "{}")
        pick_results = json.loads(record.pick_results or "{}")

        picked_team = picks.get(jornada_str)
        if not picked_team:
            continue  # usuario no hizo pick para esta jornada

        outcome = team_outcomes.get(picked_team.strip().lower())
        if outcome is None:
            continue  # el equipo elegido no juega en este partido

        pick_results[jornada_str] = outcome
        record.pick_results = json.dumps(pick_results)

        if outcome == "lost":
            record.status             = "eliminated"
            record.eliminated_in_round = jornada_id
            user = db.query(models.User).filter(models.User.id == record.user_id).first()
            if user:
                user.is_alive = False

        updated += 1

    if updated > 0:
        db.commit()
    return updated


def score_classic_knockout_match(
    db: Session,
    home_team: str,
    away_team: str,
    home_score: int,
    away_score: int,
    winning_team: Optional[str] = None,
) -> int:
    """
    Evalúa la quiniela clásica de todos los usuarios para un partido de
    eliminatoria recién finalizado. Usa bracket_snapshot para mapear el partido
    real al slot_id que cada usuario predijo.

    Retorna el número de registros actualizados.
    """
    from services.scoring import _phase_from_slot_id, PHASE_MULTIPLIERS, base_points_from_outcome

    records = db.query(models.ClassicPrediction).filter(
        models.ClassicPrediction.bracket_snapshot.isnot(None)
    ).all()

    # Determinar el ganador real (explícito para PEN, derivado del marcador para FT/AET)
    if winning_team is not None:
        real_winner = winning_team
    elif home_score > away_score:
        real_winner = home_team
    elif away_score > home_score:
        real_winner = away_team
    else:
        real_winner = None  # no debería ocurrir en eliminatorias

    updated = 0
    for record in records:
        try:
            snapshot = json.loads(record.bracket_snapshot or "{}")
            knockout_scores = json.loads(record.knockout_scores or "{}")
        except (ValueError, TypeError):
            continue

        # Buscar el slot_id donde este partido aparece en el bracket del usuario
        slot_id = None
        for sid, teams in snapshot.items():
            h = teams.get("home", "").strip().lower()
            a = teams.get("away", "").strip().lower()
            if h == home_team.strip().lower() and a == away_team.strip().lower():
                slot_id = sid
                break

        if not slot_id:
            continue  # este partido no está en el bracket guardado del usuario

        pred = knockout_scores.get(slot_id)
        if not pred:
            continue  # usuario no predijo este slot

        ph = int(pred.get("homeScore") or 0)
        pa = int(pred.get("awayScore") or 0)

        # Determinar el ganador predicho por el usuario
        if ph > pa:
            predicted_winner = home_team
        elif pa > ph:
            predicted_winner = away_team
        elif pred.get("penaltyWinner") == "home":
            predicted_winner = home_team
        elif pred.get("penaltyWinner") == "away":
            predicted_winner = away_team
        else:
            predicted_winner = None

        phase = _phase_from_slot_id(slot_id)
        multiplier = PHASE_MULTIPLIERS.get(phase, 2)

        winner_ok = (
            predicted_winner and real_winner and
            predicted_winner.strip().lower() == real_winner.strip().lower()
        )

        # Escala oficial 5/3/2/1/0 — el "ganador correcto" para eliminatorias
        # se resuelve aparte (winner_ok) porque puede depender de penales.
        base, outcome = base_points_from_outcome(ph, pa, home_score, away_score, winner_ok)
        if outcome == "exact":
            record.exact_count_classic = (record.exact_count_classic or 0) + 1

        points = base * multiplier
        record.total_points_classic = (record.total_points_classic or 0) + points
        updated += 1

    if updated > 0:
        db.commit()
    return updated