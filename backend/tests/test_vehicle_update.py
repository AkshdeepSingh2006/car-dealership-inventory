"""Only admins may replace a vehicle's validated details."""

import pytest
from fastapi.testclient import TestClient

from test_vehicle_creation import (
    VEHICLE,
    admin_token,
    client,
    create_vehicle,
    test_database_url,
    user_token,
)


def update_vehicle(client: TestClient, token: str, vehicle_id: int, data: dict):
    return client.put(
        f"/api/vehicles/{vehicle_id}",
        json=data,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_admin_updates_vehicle_and_change_persists(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201
    vehicle_id = created.json()["id"]
    updated_data = {
        "make": "Honda",
        "model": "Civic",
        "category": "Hatchback",
        "price": 28500,
        "quantity": 7,
    }

    response = update_vehicle(client, admin_token, vehicle_id, updated_data)

    assert response.status_code == 200
    assert response.json()["id"] == vehicle_id
    for field, value in updated_data.items():
        assert response.json()[field] == value
    fetched = client.get(
        f"/api/vehicles/{vehicle_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert fetched.status_code == 200
    assert fetched.json() == response.json()


@pytest.mark.parametrize(
    "invalid_data",
    [
        {**VEHICLE, "make": "   "},
        {**VEHICLE, "price": 0},
        {**VEHICLE, "quantity": -1},
        {name: value for name, value in VEHICLE.items() if name != "model"},
    ],
)
def test_invalid_update_is_rejected_without_changing_vehicle(
    client: TestClient, admin_token: str, invalid_data: dict
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    response = update_vehicle(client, admin_token, vehicle_id, invalid_data)

    assert response.status_code == 422
    fetched = client.get(
        f"/api/vehicles/{vehicle_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert fetched.json() == created.json()


def test_update_returns_404_for_missing_vehicle(
    client: TestClient, admin_token: str
) -> None:
    response = update_vehicle(client, admin_token, 999999999, VEHICLE)

    assert response.status_code == 404


def test_regular_user_cannot_update_vehicle(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201

    response = update_vehicle(client, user_token, created.json()["id"], VEHICLE)

    assert response.status_code == 403


def test_update_requires_token(client: TestClient) -> None:
    assert client.put("/api/vehicles/999999999", json=VEHICLE).status_code == 401
