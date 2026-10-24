# Car Dealership Inventory System

An assessment project for managing a dealership's vehicles and stock. The planned application has a FastAPI API backed by PostgreSQL and a React single-page frontend.

## Project status

The backend supports user registration, JWT login, and admin-only vehicle creation. Vehicle browsing, search, purchasing, and restocking are still planned. See [the development plan](docs/DEVELOPMENT_PLAN.md).

## Requirements

- Python 3.13 or compatible Python 3.11+
- Node.js 20.19+ or 22.12+ and npm
- A running PostgreSQL server and access through pgAdmin or another client

## Local setup

1. In pgAdmin, connect to your PostgreSQL server and create separate `car_dealership_dev` and `car_dealership_test` databases.
2. Copy `backend/.env.example` to `backend/.env` and fill in your local PostgreSQL username, password, host, and port. Use the development database for `DATABASE_URL` and the test database for `TEST_DATABASE_URL`. Set `JWT_SECRET` to a random secret generated locally, for example with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Do not commit `backend/.env`.
3. In `backend`, create a virtual environment, activate it, and run `python -m pip install -e ".[dev]"` after dependency installation is approved.
4. In `backend`, create the `users` and `vehicles` tables in each database before using the API or running tests. For the development database, run `python -c "from app.models import Base; from app.database import get_engine; Base.metadata.create_all(get_engine())"`. For the test database, run `python -c "from dotenv import dotenv_values; from sqlalchemy import create_engine; from app.models import Base; Base.metadata.create_all(create_engine(dotenv_values('.env')['TEST_DATABASE_URL']))"`. Run `uvicorn app.main:app --reload` to start the API.
5. Copy `frontend/.env.example` to `frontend/.env`. In `frontend`, run `npm install` after dependency installation is approved, then `npm run dev`.

The frontend defaults to `http://localhost:8000` for API requests and runs at `http://localhost:5173`. The backend allows that origin by default.

Public registration creates regular users. The controlled initial-admin setup command is still pending, so admin-only vehicle creation can currently be exercised through the test suite.

## Tests

After dependencies are installed, run `python -m pytest` from `backend` and `npm test -- --run` from `frontend`. Database tests will require `car_dealership_test`; they must never point to the development database.

### Test report

Foundation checks on 24 October 2026:

| Command | Observed result |
| --- | --- |
| `python -m pytest -q` in `backend` | 1 passed, 1 dependency deprecation warning |
| `npm test -- --run` in `frontend` | 1 test passed |
| `npm run build` in `frontend` | TypeScript check and Vite production build passed |
| `npm audit --audit-level=moderate` in `frontend` | 0 reported vulnerabilities |

Latest backend check after vehicle creation: `python -m pytest -q` on 25 October 2026 returned **41 passed, 1 dependency deprecation warning**. The foundation checks above remain as the original milestone report.

## Screenshots

Pending the completed application. Add genuine screenshots during final verification.

## My AI Usage

Codex helped plan the architecture and create the initial project foundation. As later milestones are completed, document the exact tools used, how they helped, what was manually reviewed or changed, and a personal reflection on their effect on the workflow. Raw transcripts or public chat links belong in root `PROMPTS.md`.

## Repository

Public repository URL: https://github.com/AkshdeepSingh2006/car-dealership-inventory

