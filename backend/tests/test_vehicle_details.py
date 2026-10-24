"""An authenticated user can retrieve one vehicle by its unique ID."""

from fastapi.testclient import TestClient

from test_vehicle_creation import (
    VEHICLE,
    admin_token,
    client,
    create_vehicle,
    test_database_url,
    user_token,
)


def test_user_gets_vehicle_by_id(
    client: TestClient, admin_token: str, user_token: str
) -> None:
    created = create_vehicle(client, admin_token, VEHICLE)
    assert created.status_code == 201

    response = client.get(
        f"/api/vehicles/{created.json()['id']}",
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 200
    assert response.json() == created.json()


def test_vehicle_details_returns_404_for_missing_id(
    client: TestClient, user_token: str
) -> None:
    response = client.get(
        "/api/vehicles/999999999",
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 404


def test_vehicle_details_requires_token(client: TestClient) -> None:
    assert client.get("/api/vehicles/999999999").status_code == 401
