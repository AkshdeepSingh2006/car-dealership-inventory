"""A purchase removes exactly one vehicle from available stock."""

from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from test_vehicle_creation import (
    VEHICLE,
    admin_token,
    client,
    create_vehicle,
    test_database_url,
    user_token,
)


def purchase(client: TestClient, token: str, vehicle_id: int):
    return client.post(
        f"/api/vehicles/{vehicle_id}/purchase",
        headers={"Authorization": f"Bearer {token}"},
    )


def stock(client: TestClient, token: str, vehicle_id: int) -> int:
    response = client.get(
        f"/api/vehicles/{vehicle_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    return response.json()["quantity"]


def test_user_purchases_one_vehicle_and_stock_persists(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    response = purchase(client, user_token, vehicle_id)

    assert response.status_code == 200
    assert response.json()["id"] == vehicle_id
    assert response.json()["quantity"] == VEHICLE["quantity"] - 1
    assert stock(client, user_token, vehicle_id) == VEHICLE["quantity"] - 1


def test_purchase_rejects_zero_stock(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, {**VEHICLE, "quantity": 0})
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    response = purchase(client, user_token, vehicle_id)

    assert response.status_code == 409
    assert stock(client, user_token, vehicle_id) == 0


def test_purchase_returns_404_for_missing_vehicle(
    client: TestClient, user_token: str
) -> None:
    assert purchase(client, user_token, 999999999).status_code == 404


def test_purchase_requires_token(client: TestClient) -> None:
    assert client.post("/api/vehicles/999999999/purchase").status_code == 401


def test_competing_purchases_cannot_make_stock_negative(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, {**VEHICLE, "quantity": 1})
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: purchase(client, user_token, vehicle_id), range(2)))

    assert sorted(response.status_code for response in responses) == [200, 409]
    assert stock(client, user_token, vehicle_id) == 0
