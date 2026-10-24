"""Create the first admin from a local terminal, outside public registration."""

import argparse
import getpass
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_engine
from app.models import User
from app.security import hash_password


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create the first dealership admin")
    parser.add_argument("--email", required=True, help="Email address for the new admin")
    args = parser.parse_args(argv)
    email = args.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        parser.error("enter a valid email address")

    with Session(get_engine()) as session:
        if session.scalar(select(User.id).where(User.role == "admin").limit(1)):
            print("An admin already exists; setup was not changed.")
            return 1
        if session.scalar(select(User.id).where(User.email == email)):
            print("That email is already registered; setup was not changed.")
            return 1

        password = getpass.getpass("New admin password: ")
        if not password:
            print("Password cannot be empty; setup was not changed.")
            return 1
        session.add(User(email=email, password_hash=hash_password(password), role="admin"))
        session.commit()
    print(f"Admin created for {email}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
