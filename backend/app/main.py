import os
import re
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, require_admin
from app.database import get_engine
from app.models import User, Vehicle
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


class VehicleCreate(BaseModel):
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=100)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    quantity: int = Field(ge=0, strict=True)

    @field_validator("make", "model", "category")
    @classmethod
    def nonblank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value


class VehicleResponse(VehicleCreate):
    id: int


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

    @app.get(
        "/api/vehicles",
        response_model=list[VehicleResponse],
        dependencies=[Depends(get_current_user)],
    )
    def list_vehicles() -> list[Vehicle]:
        with Session(get_engine()) as session:
            return list(session.scalars(select(Vehicle).order_by(Vehicle.id)))

    @app.get(
        "/api/vehicles/search",
        response_model=list[VehicleResponse],
        dependencies=[Depends(get_current_user)],
    )
    def search_vehicles(
        make: str | None = None,
        model: str | None = None,
        category: str | None = None,
        min_price: Decimal | None = None,
        max_price: Decimal | None = None,
    ) -> list[Vehicle]:
        query = select(Vehicle)
        for column, value in (
            (Vehicle.make, make),
            (Vehicle.model, model),
            (Vehicle.category, category),
        ):
            if value:
                query = query.where(column.icontains(value, autoescape=True))
        if min_price is not None:
            query = query.where(Vehicle.price >= min_price)
        if max_price is not None:
            query = query.where(Vehicle.price <= max_price)
        with Session(get_engine()) as session:
            return list(session.scalars(query.order_by(Vehicle.id)))

    @app.get(
        "/api/vehicles/{vehicle_id}",
        response_model=VehicleResponse,
        dependencies=[Depends(get_current_user)],
    )
    def get_vehicle(vehicle_id: int) -> Vehicle:
        with Session(get_engine()) as session:
            vehicle = session.get(Vehicle, vehicle_id)
            if vehicle is None:
                raise HTTPException(status_code=404, detail="Vehicle not found")
            return vehicle

    @app.post(
        "/api/vehicles",
        status_code=201,
        response_model=VehicleResponse,
        dependencies=[Depends(require_admin)],
    )
    def create_vehicle(request: VehicleCreate) -> Vehicle:
        with Session(get_engine()) as session:
            vehicle = Vehicle(**request.model_dump())
            session.add(vehicle)
            session.commit()
            session.refresh(vehicle)
            return vehicle

    return app


app = create_app()

