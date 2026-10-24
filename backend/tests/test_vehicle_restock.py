"""Admins can add a positive whole number of vehicles to stock."""

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
from test_vehicle_purchase import stock


def restock(client: TestClient, token: str, vehicle_id: int, data: dict):
    return client.post(
        f"/api/vehicles/{vehicle_id}/restock",
        json=data,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_admin_restocks_zero_stock_vehicle_and_change_persists(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, {**VEHICLE, "quantity": 0})
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    response = restock(client, admin_token, vehicle_id, {"quantity": 5})

    assert response.status_code == 200
    assert response.json()["id"] == vehicle_id
    assert response.json()["quantity"] == 5
    assert stock(client, user_token, vehicle_id) == 5


def test_restock_adds_to_existing_stock(
    client: TestClient, admin_token: str
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    response = restock(client, admin_token, vehicle_id, {"quantity": 2})

    assert response.status_code == 200
    assert response.json()["quantity"] == VEHICLE["quantity"] + 2
    assert stock(client, admin_token, vehicle_id) == VEHICLE["quantity"] + 2


@pytest.mark.parametrize(
    "data",
    [{"quantity": 0}, {"quantity": -1}, {"quantity": 1.5}, {"quantity": "many"}, {}],
)
def test_invalid_restock_quantity_does_not_change_stock(
    client: TestClient, admin_token: str, data: dict
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    response = restock(client, admin_token, vehicle_id, data)

    assert response.status_code == 422
    assert stock(client, admin_token, vehicle_id) == VEHICLE["quantity"]


def test_restock_returns_404_for_missing_vehicle(
    client: TestClient, admin_token: str
) -> None:
    assert restock(client, admin_token, 999999999, {"quantity": 2}).status_code == 404


def test_regular_user_cannot_restock(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    assert restock(client, user_token, vehicle_id, {"quantity": 2}).status_code == 403
    assert stock(client, user_token, vehicle_id) == VEHICLE["quantity"]


def test_restock_requires_token(client: TestClient) -> None:
    assert client.post(
        "/api/vehicles/999999999/restock", json={"quantity": 2}
    ).status_code == 401
