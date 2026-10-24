"""The first admin is created locally, never through public registration."""

from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models import Base, User


@pytest.fixture
def engine():
    # An isolated database lets these tests check the first-admin rule without
    # changing either configured PostgreSQL database.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


def test_setup_creates_first_admin_with_hashed_password(
    engine, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from app import admin_setup

    email = f"owner-{uuid4().hex}@example.com"
    password = "StrongPass123!"
    monkeypatch.setattr(admin_setup, "get_engine", lambda: engine)
    monkeypatch.setattr(admin_setup.getpass, "getpass", lambda prompt: password)

    assert admin_setup.main(["--email", email]) == 0

    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email == email))
        assert user is not None
        assert user.role == "admin"
        assert user.password_hash != password
        assert password not in user.password_hash
    assert password not in capsys.readouterr().out


def test_setup_refuses_second_admin(engine, monkeypatch: pytest.MonkeyPatch) -> None:
    from app import admin_setup

    monkeypatch.setattr(admin_setup, "get_engine", lambda: engine)
    monkeypatch.setattr(admin_setup.getpass, "getpass", lambda prompt: "StrongPass123!")

    assert admin_setup.main(["--email", "first@example.com"]) == 0
    assert admin_setup.main(["--email", "second@example.com"]) != 0

    with Session(engine) as session:
        assert [user.email for user in session.scalars(select(User)).all()] == [
            "first@example.com"
        ]


def test_setup_refuses_existing_regular_user(
    engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app import admin_setup

    with Session(engine) as session:
        session.add(
            User(email="existing@example.com", password_hash="existing-hash", role="user")
        )
        session.commit()

    monkeypatch.setattr(admin_setup, "get_engine", lambda: engine)
    monkeypatch.setattr(admin_setup.getpass, "getpass", lambda prompt: "StrongPass123!")

    assert admin_setup.main(["--email", "existing@example.com"]) != 0
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email == "existing@example.com"))
        assert user.role == "user"
