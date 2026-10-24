"""JWT creation and the dependency used by protected API routes."""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_engine
from app.models import User


bearer_scheme = HTTPBearer(auto_error=False)


def jwt_secret() -> str:
    secret = get_settings().jwt_secret
    if not secret or secret == "REPLACE_WITH_A_RANDOM_SECRET":
        raise RuntimeError("Set JWT_SECRET in backend/.env before using login")
    return secret


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    return jwt.encode(payload, jwt_secret(), algorithm="HS256")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    unauthorized = HTTPException(status_code=401, detail="Invalid or missing token")
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        payload = jwt.decode(
            credentials.credentials,
            jwt_secret(),
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
        user_id = int(payload["sub"])
    except (InvalidTokenError, ValueError, TypeError):
        raise unauthorized from None

    with Session(get_engine()) as session:
        user = session.get(User, user_id)
        if user is None:
            raise unauthorized
        return user
