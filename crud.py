from sqlalchemy.orm import Session
from passlib.context import CryptContext
from typing import Optional
import models, schemas

def _update_leaderboard(db: Session, predictions: list):
    for pred in predictions:
        entry = db.query(models.Leaderboard).filter(models.Leaderboard.user_id == pred.user_id).first()
        if not entry:
            entry = models.Leaderboard(user_id=pred.user_id, total_points=0, exact_matches_count=0)
            db.add(entry)
        entry.total_points += pred.points_earned
        if pred.points_earned == 3:
            entry.exact_matches_count += 1

    db.flush()

    # Dense rank: empates comparten posición
    all_entries = db.query(models.Leaderboard).order_by(models.Leaderboard.total_points.desc()).all()
    current_rank = 1
    for i, entry in enumerate(all_entries):
        if i > 0 and entry.total_points < all_entries[i - 1].total_points:
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
        actual_tendency = "HOME"
        derived_winner = match.home_team
    elif away_score > home_score:
        actual_tendency = "AWAY"
        derived_winner = match.away_team
    else:
        actual_tendency = "DRAW"
        derived_winner = None

    # winning_team explícito tiene prioridad; si no se pasa, se deriva del marcador
    effective_winner = winning_team if winning_team is not None else derived_winner

    # --- Clásico: Predicciones ---
    predictions = db.query(models.Prediction).filter(models.Prediction.match_id == match_id).all()
    for pred in predictions:
        if pred.predicted_home > pred.predicted_away:
            pred_tendency = "HOME"
        elif pred.predicted_away > pred.predicted_home:
            pred_tendency = "AWAY"
        else:
            pred_tendency = "DRAW"

        if pred.predicted_home == home_score and pred.predicted_away == away_score:
            pred.exact_points = 3
            pred.tendency_points = 0
            pred.points_earned = 3
        elif pred_tendency == actual_tendency:
            pred.exact_points = 0
            pred.tendency_points = 1
            pred.points_earned = 1
        else:
            pred.exact_points = 0
            pred.tendency_points = 0
            pred.points_earned = 0

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