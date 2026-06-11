from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, crud
from routers import groups, classic, survival, admin
from recalc import run_recalc

app = FastAPI(title="Quiniela API")

# Routers esenciales
app.include_router(groups.router)
app.include_router(classic.router)
app.include_router(survival.router)
app.include_router(admin.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "API activa"}

@app.get("/admin/force-recalc")
def force_recalc():
    try:
        run_recalc()
        return {"status": "success", "message": "Puntos recalculados"}
    except Exception as e:
        return {"status": "error", "message": str(e)}