from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.rbac import ANALYST_ROLES, MANAGER_ROLES
from app.core.security import TokenDecodeError, decode_access_token
from app.db.session import get_db
from app.models.entities import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class AuthContext:
    def __init__(self, user: User, org_id: str):
        self.user = user
        self.org_id = org_id


def get_current_auth(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        org_id = payload.get("org")
        if not user_id or not org_id:
            raise credentials_exception
    except TokenDecodeError as exc:
        raise credentials_exception from exc

    user = db.get(User, user_id)
    if not user or not user.is_active or user.org_id != org_id:
        raise credentials_exception

    return AuthContext(user=user, org_id=org_id)


def get_analyst_auth(auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
    if auth.user.role not in ANALYST_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
    return auth


def get_manager_auth(auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
    if auth.user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
    return auth
