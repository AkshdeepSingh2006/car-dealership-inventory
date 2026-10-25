"""Exercise the customer and admin API journey against the test database."""

from fastapi.testclient import TestClient

from test_registration import unique_email
from test_vehicle_creation import (
    VEHICLE,
    admin_token,
    client,
    test_database_url,
)


def test_registration_to_purchase_and_admin_management(
    client: TestClient, admin_token: str
) -> None:
    email = unique_email()
    password = "StrongPass123!"
    registered = client.post(
        "/api/auth/register", json={"email": email, "password": password}
    )
    assert registered.status_code == 201
    assert registered.json()["role"] == "user"

    signed_in = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert signed_in.status_code == 200
    user_headers = {"Authorization": f"Bearer {signed_in.json()['access_token']}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    assert client.get("/api/vehicles").status_code == 401
    assert client.post("/api/vehicles", json=VEHICLE, headers=user_headers).status_code == 403

    created = client.post("/api/vehicles", json=VEHICLE, headers=admin_headers)
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    listed = client.get("/api/vehicles", headers=user_headers)
    assert listed.status_code == 200
    assert any(vehicle["id"] == vehicle_id for vehicle in listed.json())
    searched = client.get(
        "/api/vehicles/search",
        params={"make": "toy", "category": "sedan", "max_price": "25000"},
        headers=user_headers,
    )
    assert searched.status_code == 200
    assert any(vehicle["id"] == vehicle_id for vehicle in searched.json())

    purchased = client.post(f"/api/vehicles/{vehicle_id}/purchase", headers=user_headers)
    assert purchased.status_code == 200
    assert purchased.json()["quantity"] == VEHICLE["quantity"] - 1
    assert client.get(f"/api/vehicles/{vehicle_id}", headers=user_headers).json()[
        "quantity"
    ] == VEHICLE["quantity"] - 1

    assert client.post(
        f"/api/vehicles/{vehicle_id}/restock",
        json={"quantity": 2},
        headers=user_headers,
    ).status_code == 403
    restocked = client.post(
        f"/api/vehicles/{vehicle_id}/restock",
        json={"quantity": 2},
        headers=admin_headers,
    )
    assert restocked.status_code == 200
    assert restocked.json()["quantity"] == VEHICLE["quantity"] + 1

    updated = client.put(
        f"/api/vehicles/{vehicle_id}",
        json={**VEHICLE, "model": "Corolla Hybrid", "quantity": restocked.json()["quantity"]},
        headers=admin_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["model"] == "Corolla Hybrid"
    assert client.delete(f"/api/vehicles/{vehicle_id}", headers=user_headers).status_code == 403
    assert client.delete(f"/api/vehicles/{vehicle_id}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/vehicles/{vehicle_id}", headers=user_headers).status_code == 404
