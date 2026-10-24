"""Only admins may delete vehicles from the inventory."""

from fastapi.testclient import TestClient

from test_vehicle_creation import (
    VEHICLE,
    admin_token,
    client,
    create_vehicle,
    test_database_url,
    user_token,
)


def delete_vehicle(client: TestClient, token: str, vehicle_id: int):
    return client.delete(
        f"/api/vehicles/{vehicle_id}",
        headers={"Authorization": f"Bearer {token}"},
    )


def test_admin_deletes_vehicle(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    response = delete_vehicle(client, admin_token, vehicle_id)

    assert response.status_code == 204
    fetched = client.get(
        f"/api/vehicles/{vehicle_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert fetched.status_code == 404


def test_delete_returns_404_for_missing_vehicle(
    client: TestClient, admin_token: str
) -> None:
    assert delete_vehicle(client, admin_token, 999999999).status_code == 404


def test_regular_user_cannot_delete_vehicle(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201
    vehicle_id = created.json()["id"]

    assert delete_vehicle(client, user_token, vehicle_id).status_code == 403
    fetched = client.get(
        f"/api/vehicles/{vehicle_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert fetched.status_code == 200


def test_delete_requires_token(client: TestClient) -> None:
    assert client.delete("/api/vehicles/999999999").status_code == 401
