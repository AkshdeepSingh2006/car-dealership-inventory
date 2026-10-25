"""Sample inventory can be added safely to an empty development database."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models import Base, Vehicle
from app.seed_vehicles import SAMPLE_VEHICLES, seed_if_empty


def test_seed_adds_varied_vehicles_to_empty_inventory() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        assert seed_if_empty(session) == len(SAMPLE_VEHICLES)
        vehicles = list(session.scalars(select(Vehicle).order_by(Vehicle.id)))

    assert len(vehicles) >= 6
    assert len({vehicle.category for vehicle in vehicles}) >= 3
    assert all(vehicle.price > Decimal("0") for vehicle in vehicles)
    assert any(vehicle.quantity == 0 for vehicle in vehicles)
    assert any(vehicle.quantity > 0 for vehicle in vehicles)


def test_seed_is_repeatable_without_adding_duplicates() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        assert seed_if_empty(session) == len(SAMPLE_VEHICLES)
        assert seed_if_empty(session) == 0
        assert len(list(session.scalars(select(Vehicle)))) == len(SAMPLE_VEHICLES)


def test_seed_leaves_existing_inventory_untouched() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(Vehicle(
            make="Existing", model="Car", category="Custom",
            price=Decimal("10000.00"), quantity=1,
        ))
        session.commit()
        assert seed_if_empty(session) == 0
        vehicles = list(session.scalars(select(Vehicle)))

    assert len(vehicles) == 1
    assert vehicles[0].make == "Existing"


def test_seeded_vehicle_is_listed_and_purchase_changes_persisted_stock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Seeded cars use the same protected API and stock update as admin-created cars."""
    from app import auth, main

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        assert seed_if_empty(session) == len(SAMPLE_VEHICLES)

    monkeypatch.setattr(main, "get_engine", lambda: engine)
    monkeypatch.setattr(auth, "get_engine", lambda: engine)
    monkeypatch.setattr(auth, "jwt_secret", lambda: "seed-test-only-jwt-key-32-characters-long")

    with TestClient(main.app) as client:
        registration = client.post(
            "/api/auth/register",
            json={"email": "seed-buyer@example.com", "password": "StrongPass123!"},
        )
        assert registration.status_code == 201
        login = client.post(
            "/api/auth/login",
            json={"email": "seed-buyer@example.com", "password": "StrongPass123!"},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        listing = client.get("/api/vehicles", headers=headers)
        assert listing.status_code == 200
        assert len(listing.json()) == len(SAMPLE_VEHICLES)
        vehicle = next(car for car in listing.json() if car["quantity"] > 0)

        purchase = client.post(f"/api/vehicles/{vehicle['id']}/purchase", headers=headers)
        assert purchase.status_code == 200
        assert purchase.json()["quantity"] == vehicle["quantity"] - 1

    with Session(engine) as session:
        persisted = session.get(Vehicle, vehicle["id"])
        assert persisted is not None
        assert persisted.quantity == vehicle["quantity"] - 1
