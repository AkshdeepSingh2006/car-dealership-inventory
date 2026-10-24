import os
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import create_access_token
from app.database import get_engine
from app.models import User
from app.security import hash_password, verify_password


class CredentialsRequest(BaseModel):
    email: str
    password: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ValueError("Enter a valid email address")
        return email


class RegistrationRequest(CredentialsRequest):
    """Request body for public registration."""


class LoginRequest(CredentialsRequest):
    """Request body for login."""


class RegistrationResponse(BaseModel):
    id: int
    email: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


def create_app(frontend_origin: str | None = None) -> FastAPI:
    app = FastAPI(title="Car Dealership Inventory API")
    allowed_origin = frontend_origin or os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[allowed_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/auth/register", status_code=201, response_model=RegistrationResponse)
    def register(request: RegistrationRequest) -> User:
        with Session(get_engine()) as session:
            user = User(
                email=request.email,
                password_hash=hash_password(request.password),
                role="user",
            )
            session.add(user)
            try:
                session.commit()
            except IntegrityError as error:
                session.rollback()
                raise HTTPException(status_code=409, detail="Email already registered") from error
            session.refresh(user)
            return user

    @app.post("/api/auth/login", response_model=TokenResponse)
    def login(request: LoginRequest) -> TokenResponse:
        with Session(get_engine()) as session:
            user = session.scalar(select(User).where(User.email == request.email))
            if user is None or not verify_password(request.password, user.password_hash):
                raise HTTPException(status_code=401, detail="Invalid email or password")
            return TokenResponse(
                access_token=create_access_token(user.id), token_type="bearer"
            )

    return app


app = create_app()

