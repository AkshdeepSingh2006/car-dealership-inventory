"""Vehicle creation behavior, specified before the endpoint exists."""

import os
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


VEHICLE = {
    "make": "Toyota",
    "model": "Corolla",
    "category": "Sedan",
    "price": 25000,
    "quantity": 3,
}


@pytest.fixture
def test_database_url(monkeypatch: pytest.MonkeyPatch) -> str:
    env_file = Path(__file__).resolve().parents[1] / ".env"
    file_values = dotenv_values(env_file)
    test_url = os.getenv("TEST_DATABASE_URL") or file_values.get("TEST_DATABASE_URL")
    dev_url = os.getenv("DATABASE_URL") or file_values.get("DATABASE_URL")
    assert test_url and dev_url, "Configure separate development and test database URLs"
    assert make_url(test_url).database == "car_dealership_test"
    assert make_url(dev_url).database == "car_dealership_dev"

    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("JWT_SECRET", "vehicle-tests-only-jwt-signing-key")
    return test_url


@pytest.fixture
def client(test_database_url: str) -> TestClient:
    from app.config import get_settings
    from app.database import get_engine
    from app.main import app

    get_engine.cache_clear()
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
    get_engine.cache_clear()
    get_settings.cache_clear()


def token_for_role(client: TestClient, test_database_url: str, role: str) -> str:
    email = f"vehicle-{uuid4().hex}@example.com"
    password = "StrongPass123!"
    registration = client.post(
        "/api/auth/register", json={"email": email, "password": password}
    )
    assert registration.status_code == 201
    assert registration.json()["role"] == "user"

    if role == "admin":
        # Controlled test setup only; public registration must stay regular-user only.
        engine = create_engine(test_database_url)
        try:
            with engine.begin() as connection:
                connection.execute(
                    text("UPDATE users SET role = 'admin' WHERE id = :id"),
                    {"id": registration.json()["id"]},
                )
        finally:
            engine.dispose()

    login = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert login.status_code == 200
    return login.json()["access_token"]


@pytest.fixture
def admin_token(client: TestClient, test_database_url: str) -> str:
    return token_for_role(client, test_database_url, "admin")


@pytest.fixture
def user_token(client: TestClient, test_database_url: str) -> str:
    return token_for_role(client, test_database_url, "user")


def create_vehicle(client: TestClient, token: str, payload: dict) -> object:
    return client.post(
        "/api/vehicles",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_admin_creates_vehicle_and_data_persists(
    client: TestClient, admin_token: str, test_database_url: str
) -> None:
    response = create_vehicle(client, admin_token, VEHICLE)

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int) and body["id"] > 0
    assert body["make"] == VEHICLE["make"]
    assert body["model"] == VEHICLE["model"]
    assert body["category"] == VEHICLE["category"]
    assert Decimal(str(body["price"])) == Decimal("25000")
    assert body["quantity"] == 3

    engine = create_engine(test_database_url)
    try:
        with engine.connect() as connection:
            stored = connection.execute(
                text(
                    "SELECT make, model, category, price, quantity "
                    "FROM vehicles WHERE id = :id"
                ),
                {"id": body["id"]},
            ).mappings().one()
        assert stored["make"] == VEHICLE["make"]
        assert stored["model"] == VEHICLE["model"]
        assert stored["category"] == VEHICLE["category"]
        assert Decimal(str(stored["price"])) == Decimal("25000")
        assert stored["quantity"] == 3
    finally:
        engine.dispose()


def test_identical_vehicles_get_different_ids(client: TestClient, admin_token: str) -> None:
    first = create_vehicle(client, admin_token, VEHICLE)
    second = create_vehicle(client, admin_token, VEHICLE)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


@pytest.mark.parametrize("field", list(VEHICLE))
def test_missing_required_field_is_rejected(
    client: TestClient, admin_token: str, field: str
) -> None:
    payload = {name: value for name, value in VEHICLE.items() if name != field}

    response = create_vehicle(client, admin_token, payload)

    assert response.status_code == 422


@pytest.mark.parametrize("field", ["make", "model", "category"])
def test_blank_vehicle_text_is_rejected(
    client: TestClient, admin_token: str, field: str
) -> None:
    response = create_vehicle(client, admin_token, {**VEHICLE, field: "   "})

    assert response.status_code == 422


@pytest.mark.parametrize("price", [0, -1, "not-a-price"])
def test_invalid_price_is_rejected(
    client: TestClient, admin_token: str, price: object
) -> None:
    response = create_vehicle(client, admin_token, {**VEHICLE, "price": price})

    assert response.status_code == 422


@pytest.mark.parametrize("quantity", [-1, 1.5, "many"])
def test_invalid_stock_quantity_is_rejected(
    client: TestClient, admin_token: str, quantity: object
) -> None:
    response = create_vehicle(client, admin_token, {**VEHICLE, "quantity": quantity})

    assert response.status_code == 422


def test_zero_stock_is_allowed(client: TestClient, admin_token: str) -> None:
    response = create_vehicle(client, admin_token, {**VEHICLE, "quantity": 0})

    assert response.status_code == 201
    assert response.json()["quantity"] == 0


def test_missing_token_is_rejected(client: TestClient) -> None:
    response = client.post("/api/vehicles", json=VEHICLE)

    assert response.status_code == 401


def test_invalid_token_is_rejected(client: TestClient) -> None:
    response = create_vehicle(client, "not-a-jwt", VEHICLE)

    assert response.status_code == 401


def test_regular_user_cannot_create_vehicle(client: TestClient, user_token: str) -> None:
    response = create_vehicle(client, user_token, VEHICLE)

    assert response.status_code == 403
