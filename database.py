from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./quiniela.db")

# Railway y Heroku entregan "postgres://" o "postgresql://".
# SQLAlchemy 2.0 requiere "postgresql://" (no "postgres://").
# Normalizamos también a psycopg2 explícito para evitar ambigüedad con asyncpg.
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

_is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

# SQLite necesita check_same_thread=False; PostgreSQL no lo acepta.
connect_args = {"check_same_thread": False} if _is_sqlite else {}

# Pool de conexiones: SQLite no soporta parámetros de pool de servidor.
engine_kwargs: dict = {"connect_args": connect_args}
if not _is_sqlite:
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,   # detecta conexiones muertas antes de usarlas
    })

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()