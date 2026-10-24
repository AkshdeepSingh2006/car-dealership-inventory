"""Search uses optional vehicle attributes and inclusive price bounds."""

from uuid import uuid4

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


@pytest.fixture
def vehicles(client: TestClient, admin_token: str) -> tuple[dict, dict]:
    suffix = uuid4().hex
    first = create_vehicle(
        client,
        admin_token,
        {
            **VEHICLE,
            "make": f"SearchMake{suffix}",
            "model": f"SearchModelA{suffix}",
            "category": f"SearchCategoryA{suffix}",
            "price": 20000,
        },
    )
    second = create_vehicle(
        client,
        admin_token,
        {
            **VEHICLE,
            "make": f"SearchOther{suffix}",
            "model": f"SearchModelB{suffix}",
            "category": f"SearchCategoryB{suffix}",
            "price": 40000,
        },
    )
    assert first.status_code == second.status_code == 201
    return first.json(), second.json()


@pytest.mark.parametrize("field", ["make", "model", "category"])
def test_searches_each_text_field(
    client: TestClient, user_token: str, vehicles: tuple[dict, dict], field: str
) -> None:
    first, second = vehicles
    query = first[field][6:].lower()

    response = client.get(
        "/api/vehicles/search",
        params={field: query},
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 200
    ids = {vehicle["id"] for vehicle in response.json()}
    assert first["id"] in ids
    assert second["id"] not in ids


def test_searches_inclusive_price_range(
    client: TestClient, user_token: str, vehicles: tuple[dict, dict]
) -> None:
    first, second = vehicles

    response = client.get(
        "/api/vehicles/search",
        params={"min_price": 20000, "max_price": 20000},
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 200
    ids = {vehicle["id"] for vehicle in response.json()}
    assert first["id"] in ids
    assert second["id"] not in ids


def test_combines_filters(
    client: TestClient, user_token: str, vehicles: tuple[dict, dict]
) -> None:
    first, second = vehicles

    response = client.get(
        "/api/vehicles/search",
        params={"make": first["make"], "category": second["category"]},
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 200
    assert response.json() == []


def test_search_returns_empty_list_for_no_matches(
    client: TestClient, user_token: str
) -> None:
    response = client.get(
        "/api/vehicles/search",
        params={"make": f"NoSuchMake{uuid4().hex}"},
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 200
    assert response.json() == []


def test_search_requires_token(client: TestClient) -> None:
    assert client.get("/api/vehicles/search").status_code == 401


@pytest.mark.parametrize(
    "params",
    [
        {"min_price": -1},
        {"max_price": -1},
        {"min_price": 30000, "max_price": 20000},
        {"min_price": "not-a-number"},
    ],
)
def test_rejects_invalid_price_filters(
    client: TestClient, user_token: str, params: dict
) -> None:
    response = client.get(
        "/api/vehicles/search",
        params=params,
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 422
