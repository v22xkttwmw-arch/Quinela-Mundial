from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models, schemas, crud, auth
from deps import get_current_user, get_current_admin
from routers import groups
import stripe
import os
from datetime import datetime, timedelta
from services import football_api as fb_api

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
INSCRIPTION_PRICE_CENTS = int(os.getenv("INSCRIPTION_PRICE_CENTS", 1000))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ALLOWED_ORIGINS: lista separada por comas. Usar "*" solo en dev.
# Ejemplo prod: https://tu-frontend.vercel.app,https://quiniela.com
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",")]

# Esquema gestionado por Alembic — ejecuta `alembic upgrade head` antes de arrancar
# Base.metadata.create_all(bind=engine)  ← solo para tests unitarios sin Alembic

app = FastAPI(title="Quiniela API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(groups.router)

@app.get("/")
def read_root():
    return {"message": "API de la Quiniela Mundialista activa"}

@app.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    return crud.create_user(db=db, user=user)

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/payments/create-checkout-session", response_model=schemas.CheckoutSessionResponse)
def create_checkout_session(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_paid:
        raise HTTPException(status_code=400, detail="Ya estás inscrito en la quiniela")
    if not stripe.api_key or stripe.api_key == "sk_test_REPLACE_ME":
        raise HTTPException(status_code=503, detail="Pasarela de pago no configurada")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "eur",
                "product_data": {"name": "Inscripción Quiniela"},
                "unit_amount": INSCRIPTION_PRICE_CENTS,
            },
            "quantity": 1,
        }],
        mode="payment",
        customer_email=current_user.email,
        metadata={"user_id": current_user.id},
        success_url=f"{FRONTEND_URL}/payment-success",
        cancel_url=f"{FRONTEND_URL}/payment-cancel",
    )

    crud.create_payment_record(
        db,
        user_id=current_user.id,
        stripe_session_id=session.id,
        amount=INSCRIPTION_PRICE_CENTS / 100,
    )
    return {"checkout_url": session.url}


@app.post("/payments/webhook", status_code=200)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Payload inválido")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Firma del webhook inválida")

    if event["type"] == "checkout.session.completed":
        stripe_session = event["data"]["object"]
        crud.confirm_payment(db, stripe_session_id=stripe_session["id"])

    return {"status": "ok"}


@app.post("/simulate-payment/", response_model=schemas.UserResponse)
def simulate_payment(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return crud.mark_user_as_paid(db=db, user_id=current_user.id)

@app.post("/matches/", response_model=schemas.MatchResponse)
def create_match(
    match: schemas.MatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    return crud.create_match(db=db, match=match)

@app.post("/predictions/", response_model=schemas.PredictionResponse)
def create_prediction(
    prediction: schemas.PredictionCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.is_paid:
        raise HTTPException(status_code=403, detail="Debes pagar la inscripción para participar")
    match = db.query(models.Match).filter(models.Match.id == prediction.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    if datetime.utcnow() >= match.kickoff_time - timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="El tiempo para predecir este partido ha expirado")
    return crud.create_prediction(db=db, prediction=prediction, user_id=current_user.id)

@app.post("/matches/{match_id}/finish", response_model=schemas.MatchResponse)
def finish_match(
    match_id: int,
    result: schemas.MatchResultCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    match = crud.finish_match_and_calculate_points(
        db=db,
        match_id=match_id,
        home_score=result.home_score,
        away_score=result.away_score,
        winning_team=result.winning_team,
    )
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    return match

@app.post("/admin/sync-fixtures")
def sync_fixtures(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Descarga los próximos partidos de API-Football y los inserta en la BD (idempotente)."""
    try:
        fixtures = fb_api.get_upcoming_fixtures()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al contactar API-Football: {e}")

    created = sum(
        crud.upsert_match_from_api(db, fb_api.parse_fixture(f))
        for f in fixtures
    )
    return {"total_from_api": len(fixtures), "created": created, "skipped": len(fixtures) - created}


@app.post("/admin/sync-results")
def sync_results(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Descarga los partidos finalizados de API-Football.
    Por cada partido que en nuestra BD aún no esté marcado como FT,
    dispara finish_match_and_calculate_points y actualiza el leaderboard.
    """
    try:
        fixtures = fb_api.get_finished_fixtures()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al contactar API-Football: {e}")

    updated = 0
    for fixture in fixtures:
        parsed = fb_api.parse_fixture(fixture)

        if parsed["home_score"] is None or parsed["away_score"] is None:
            continue

        match = crud.get_match_by_api_id(db, parsed["api_match_id"])
        if not match or match.status == "FT":
            continue  # no existe en nuestra BD o ya procesado

        crud.finish_match_and_calculate_points(
            db,
            match_id=match.id,
            home_score=parsed["home_score"],
            away_score=parsed["away_score"],
        )
        updated += 1

    return {"checked": len(fixtures), "updated": updated}


@app.get("/matches/all", response_model=list[schemas.MatchResponse])
def list_all_matches(db: Session = Depends(get_db)):
    return db.query(models.Match).order_by(models.Match.kickoff_time).all()

@app.get("/matches/", response_model=list[schemas.MatchResponse])
def list_matches(db: Session = Depends(get_db)):
    return (
        db.query(models.Match)
        .filter(models.Match.status != "FT")
        .order_by(models.Match.kickoff_time)
        .all()
    )

@app.get("/leaderboard", response_model=list[schemas.LeaderboardEntry])
def get_leaderboard(db: Session = Depends(get_db)):
    return db.query(models.Leaderboard).order_by(models.Leaderboard.rank_position).all()

@app.get("/leaderboard/global", response_model=list[schemas.GlobalLeaderboardEntry])
def global_leaderboard(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    entries = []
    for user in users:
        lb = db.query(models.Leaderboard).filter(
            models.Leaderboard.user_id == user.id
        ).first()
        entries.append(schemas.GlobalLeaderboardEntry(
            rank=0,
            user=schemas.LeaderboardUserInfo(id=user.id, email=user.email),
            total_points=lb.total_points if lb else 0,
            exact_matches_count=lb.exact_matches_count if lb else 0,
        ))
    entries.sort(key=lambda x: x.total_points, reverse=True)
    for i, entry in enumerate(entries):
        entry.rank = i + 1
    return entries

@app.get("/survivors/global", response_model=list[schemas.GlobalSurvivorEntry])
def global_survivors(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    entries = []
    for user in users:
        last_pick = (
            db.query(models.SurvivorPick)
            .filter(models.SurvivorPick.user_id == user.id)
            .order_by(models.SurvivorPick.created_at.desc())
            .first()
        )
        is_eliminated = (
            db.query(models.SurvivorPick)
            .filter(
                models.SurvivorPick.user_id == user.id,
                models.SurvivorPick.is_correct == False,
            )
            .first()
        ) is not None
        entries.append(schemas.GlobalSurvivorEntry(
            user=schemas.LeaderboardUserInfo(id=user.id, email=user.email),
            is_alive=not is_eliminated,
            last_team_picked=last_pick.team_id if last_pick else None,
        ))
    entries.sort(key=lambda x: (not x.is_alive,))
    return entries

# --- NUEVA RUTA: VER MIS PREDICCIONES Y PUNTOS ---
@app.get("/predictions/me", response_model=list[schemas.PredictionResponse])
def get_my_predictions(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Devuelve una lista con todas las predicciones que ha hecho el usuario logueado
    return db.query(models.Prediction).filter(models.Prediction.user_id == current_user.id).all()