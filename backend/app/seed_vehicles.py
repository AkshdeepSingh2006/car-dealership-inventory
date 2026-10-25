"""Add illustrative inventory to an empty development database."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_engine
from app.models import Vehicle


SAMPLE_VEHICLES = (
    {"make": "Toyota", "model": "Corolla", "category": "Sedan", "price": Decimal("24500.00"), "quantity": 4},
    {"make": "Honda", "model": "Civic", "category": "Sedan", "price": Decimal("27800.00"), "quantity": 3},
    {"make": "Hyundai", "model": "Tucson", "category": "SUV", "price": Decimal("32200.00"), "quantity": 2},
    {"make": "Kia", "model": "Sportage", "category": "SUV", "price": Decimal("30500.00"), "quantity": 4},
    {"make": "Mazda", "model": "CX-5", "category": "SUV", "price": Decimal("34900.00"), "quantity": 2},
    {"make": "Volkswagen", "model": "Golf", "category": "Hatchback", "price": Decimal("26100.00"), "quantity": 2},
    {"make": "Ford", "model": "Mustang", "category": "Coupe", "price": Decimal("48900.00"), "quantity": 1},
    {"make": "BMW", "model": "3 Series", "category": "Sedan", "price": Decimal("46500.00"), "quantity": 0},
)


def seed_if_empty(session: Session) -> int:
    """Insert sample cars once, leaving any existing inventory alone."""
    if session.scalar(select(Vehicle.id).limit(1)) is not None:
        return 0
    session.add_all(Vehicle(**details) for details in SAMPLE_VEHICLES)
    session.commit()
    return len(SAMPLE_VEHICLES)


def main() -> int:
    engine = get_engine()
    if engine.url.database != "car_dealership_dev":
        print("Refusing to seed a database other than car_dealership_dev.")
        return 1
    with Session(engine) as session:
        count = seed_if_empty(session)
    print(f"Added {count} sample vehicles." if count else "Inventory already has vehicles; nothing added.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
