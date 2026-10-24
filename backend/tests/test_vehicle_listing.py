"""Authenticated users can browse the stored vehicle inventory."""

from fastapi.testclient import TestClient

from test_vehicle_creation import (
    VEHICLE,
    admin_token,
    client,
    create_vehicle,
    test_database_url,
    user_token,
)


def test_user_lists_stored_vehicles_including_zero_stock(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    first = create_vehicle(client, admin_token, VEHICLE)
    second = create_vehicle(
        client, admin_token, {**VEHICLE, "model": "Prius", "quantity": 0}
    )
    assert first.status_code == second.status_code == 201

    response = client.get(
        "/api/vehicles", headers={"Authorization": f"Bearer {user_token}"}
    )

    assert response.status_code == 200
    by_id = {vehicle["id"]: vehicle for vehicle in response.json()}
    assert by_id[first.json()["id"]] == first.json()
    assert by_id[second.json()["id"]] == second.json()


def test_listing_requires_token(client: TestClient) -> None:
    assert client.get("/api/vehicles").status_code == 401
    assert client.get(
        "/api/vehicles", headers={"Authorization": "Bearer not-a-jwt"}
    ).status_code == 401
