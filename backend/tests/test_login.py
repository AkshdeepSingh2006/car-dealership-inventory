"""Login and JWT behavior, specified before implementation."""

import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from uuid import uuid4

import pytest
from dotenv import dotenv_values
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url


TEST_JWT_SECRET = "test-only-jwt-signing-key-never-used-outside-tests"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    env_file = Path(__file__).resolve().parents[1] / ".env"
    file_values = dotenv_values(env_file)
    test_url = os.getenv("TEST_DATABASE_URL") or file_values.get("TEST_DATABASE_URL")
    dev_url = os.getenv("DATABASE_URL") or file_values.get("DATABASE_URL")
    assert test_url, "Configure TEST_DATABASE_URL before running login tests"
    assert dev_url, "Configure DATABASE_URL so tests can verify database separation"
    assert make_url(test_url).database == "car_dealership_test"
    assert make_url(dev_url).database == "car_dealership_dev"

    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("JWT_SECRET", TEST_JWT_SECRET)

    from app.config import get_settings
    from app.database import get_engine
    from app.main import app

    get_engine.cache_clear()
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
    get_engine.cache_clear()
    get_settings.cache_clear()


@pytest.fixture
def registered_user(client: TestClient) -> dict:
    email = f"login-{uuid4().hex}@example.com"
    password = "StrongPass123!"
    response = client.post(
        "/api/auth/register", json={"email": email, "password": password}
    )
    assert response.status_code == 201
    return {"id": response.json()["id"], "email": email, "password": password}


def login(client: TestClient, user: dict) -> object:
    return client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )


def jwt_part(part: str) -> dict:
    padded = part + "=" * (-len(part) % 4)
    return json.loads(base64.urlsafe_b64decode(padded))


def protected_client() -> TestClient:
    # This route exists only in the test. Production vehicle routes will use
    # the same authentication dependency in their own milestone.
    from app.auth import get_current_user

    app = FastAPI()

    @app.get("/protected")
    def protected(user=Depends(get_current_user)) -> dict:
        return {"id": user.id, "email": user.email}

    return TestClient(app)


def test_valid_login_returns_bearer_token(
    client: TestClient, registered_user: dict
) -> None:
    response = login(client, registered_user)

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert isinstance(response.json()["access_token"], str)
    assert response.json()["access_token"]


def test_wrong_password_is_rejected(client: TestClient, registered_user: dict) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": registered_user["email"], "password": "WrongPass123!"},
    )

    assert response.status_code == 401


def test_unknown_email_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": f"unknown-{uuid4().hex}@example.com", "password": "StrongPass123!"},
    )

    assert response.status_code == 401


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "StrongPass123!"},
        {"email": "person@example.com", "password": ""},
        {"email": "person@example.com"},
    ],
)
def test_malformed_login_is_rejected(client: TestClient, payload: dict) -> None:
    response = client.post("/api/auth/login", json=payload)

    assert response.status_code == 422


def test_login_creates_signed_jwt_for_user(
    client: TestClient, registered_user: dict
) -> None:
    response = login(client, registered_user)
    assert response.status_code == 200

    token = response.json()["access_token"]
    header_part, payload_part, signature_part = token.split(".")
    assert jwt_part(header_part)["alg"] == "HS256"
    payload = jwt_part(payload_part)
    assert payload["sub"] == str(registered_user["id"])
    assert payload["exp"] > time.time()

    message = f"{header_part}.{payload_part}".encode()
    expected_signature = base64.urlsafe_b64encode(
        hmac.new(TEST_JWT_SECRET.encode(), message, hashlib.sha256).digest()
    ).rstrip(b"=")
    assert hmac.compare_digest(signature_part.encode(), expected_signature)


def test_protected_route_rejects_missing_token(client: TestClient) -> None:
    response = protected_client().get("/protected")

    assert response.status_code == 401


@pytest.mark.parametrize("token", ["not-a-jwt", "invalid.signature.value"])
def test_protected_route_rejects_invalid_token(
    client: TestClient, token: str
) -> None:
    response = protected_client().get(
        "/protected", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401


def test_protected_route_accepts_valid_token(
    client: TestClient, registered_user: dict
) -> None:
    response = login(client, registered_user)
    assert response.status_code == 200

    protected_response = protected_client().get(
        "/protected",
        headers={"Authorization": f"Bearer {response.json()['access_token']}"},
    )

    assert protected_response.status_code == 200
    assert protected_response.json() == {
        "id": registered_user["id"],
        "email": registered_user["email"],
    }
