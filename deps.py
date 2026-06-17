from typing import Optional
from datetime import datetime
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from database import get_db
import models, crud, auth

# auto_error=False: si no hay header Authorization, no falla de inmediato —
# intentamos leer el token desde la cookie HttpOnly a continuación.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


def get_current_user(
    request: Request,
    token_header: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    # Prioridad: Authorization header > cookie HttpOnly "token"
    token = token_header or request.cookies.get("token")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    user.last_active = datetime.utcnow()
    db.commit()
    return user


def get_optional_user(
    request: Request,
    token_header: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    token = token_header or request.cookies.get("token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None
    user = crud.get_user_by_email(db, email=email)
    if user:
        user.last_active = datetime.utcnow()
        db.commit()
    return user


def get_current_admin(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requieren permisos de administrador")
    return current_user
