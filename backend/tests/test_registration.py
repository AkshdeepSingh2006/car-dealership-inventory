"""Public registration behavior, written before the endpoint exists."""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text


def unique_email() -> str:
    return f"registration-{uuid4().hex}@example.com"


@pytest.fixture
def test_database_url(monkeypatch: pytest.MonkeyPatch) -> str | None:
    """Keep registration tests away from the development database."""
    env_file = Path(__file__).resolve().parents[1] / ".env"
    file_values = dotenv_values(env_file)
    test_url = os.getenv("TEST_DATABASE_URL") or file_values.get("TEST_DATABASE_URL")
    dev_url = os.getenv("DATABASE_URL") or file_values.get("DATABASE_URL")

    if test_url:
        assert test_url != dev_url, "TEST_DATABASE_URL must differ from DATABASE_URL"
        monkeypatch.setenv("DATABASE_URL", test_url)

    yield test_url

    # Settings and engine are cached; do not leave the test URL cached for other tests.
    from app.config import get_settings
    from app.database import get_engine

    get_engine.cache_clear()
    get_settings.cache_clear()


@pytest.fixture
def client(test_database_url: str | None) -> TestClient:
    from app.config import get_settings
    from app.database import get_engine
    from app.main import app

    get_engine.cache_clear()
    get_settings.cache_clear()
    if any(route.path == "/api/auth/register" for route in app.routes):
        assert test_database_url, "Configure TEST_DATABASE_URL before running registration tests"

    with TestClient(app) as test_client:
        yield test_client


def stored_user(test_database_url: str | None, email: str) -> dict:
    assert test_database_url, "Configure TEST_DATABASE_URL to inspect stored users"
    engine = create_engine(test_database_url)
    try:
        with engine.connect() as connection:
            row = connection.execute(
                text("SELECT email, password_hash, role FROM users WHERE email = :email"),
                {"email": email},
            ).mappings().one()
            return dict(row)
    finally:
        engine.dispose()


def test_registers_regular_user(client: TestClient) -> None:
    email = unique_email()

    response = client.post(
        "/api/auth/register", json={"email": email, "password": "StrongPass123!"}
    )

    assert response.status_code == 201
    assert response.json()["email"] == email
    assert response.json()["role"] == "user"
    assert "password" not in response.json()
    assert "password_hash" not in response.json()


def test_rejects_duplicate_email(client: TestClient) -> None:
    email = unique_email()
    payload = {"email": email, "password": "StrongPass123!"}

    first_response = client.post("/api/auth/register", json=payload)
    second_response = client.post("/api/auth/register", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "StrongPass123!"},
        {"email": "", "password": "StrongPass123!"},
        {"email": "someone@example.com", "password": ""},
        {"email": "someone@example.com"},
    ],
)
def test_rejects_invalid_registration_input(client: TestClient, payload: dict) -> None:
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 422


def test_stores_password_as_hash(
    client: TestClient, test_database_url: str | None
) -> None:
    email = unique_email()
    password = "StrongPass123!"

    response = client.post(
        "/api/auth/register", json={"email": email, "password": password}
    )

    assert response.status_code == 201
    password_hash = stored_user(test_database_url, email)["password_hash"]
    assert password_hash
    assert password_hash != password
    assert password not in password_hash


@pytest.mark.parametrize("admin_field", [{"role": "admin"}, {"is_admin": True}])
def test_public_registration_cannot_create_admin(
    client: TestClient, test_database_url: str | None, admin_field: dict
) -> None:
    email = unique_email()
    payload = {"email": email, "password": "StrongPass123!", **admin_field}

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    assert response.json()["role"] == "user"
    assert stored_user(test_database_url, email)["role"] == "user"
