# Car Dealership Inventory System

An assessment project for managing a dealership's vehicles and stock. The planned application has a FastAPI API backed by PostgreSQL and a React single-page frontend.

## Project status

The backend supports user registration, JWT login, a local first-admin setup command, authenticated vehicle browsing, search, and purchase, plus admin-only vehicle creation, update, deletion, and restock. The frontend is still planned. See [the development plan](docs/DEVELOPMENT_PLAN.md).

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

Public registration creates regular users. To create the first admin, set `DATABASE_URL` to your development database in `backend/.env`, then run this once from `backend`:

```powershell
.\.venv\Scripts\python.exe -m app.admin_setup --email you@example.com
```

The command prompts for the password without putting it in shell history. It refuses to change an existing user or create a second admin. Do not run it against the test database. The command changes the database, so get approval before running it.

Authenticated users can list vehicles with `GET /api/vehicles` and filter with `GET /api/vehicles/search`. Search accepts optional `make`, `model`, `category`, `min_price`, and `max_price` query parameters. Text filters match part of a value without case sensitivity; price bounds are inclusive. Multiple filters combine.

Authenticated users can retrieve one vehicle with `GET /api/vehicles/{id}`. Admins can replace a vehicle's details with `PUT /api/vehicles/{id}` using all five vehicle fields, or remove one with `DELETE /api/vehicles/{id}`. Unknown IDs return `404`. Search rejects negative or reversed price bounds with `422`.

An authenticated user can call `POST /api/vehicles/{id}/purchase` to buy one vehicle and decrease stock by one. A zero-stock purchase returns `409`; competing purchases cannot make stock negative. An admin can call `POST /api/vehicles/{id}/restock` with a JSON body such as `{"quantity": 5}` to add a positive whole number to stock.

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

Backend check after vehicle creation: `python -m pytest -q` on 25 October 2026 returned **41 passed, 1 dependency deprecation warning**. The foundation checks above remain as the original milestone report.

Backend check after first-admin setup, listing, and search: `.\.venv\Scripts\python.exe -m pytest -q --tb=line` on 25 October 2026 returned **53 passed, 1 dependency deprecation warning**.

Backend check after vehicle details, update, delete, and search validation: `.\.venv\Scripts\python.exe -m pytest -q --tb=short` on 25 October 2026 returned **72 passed, 1 dependency deprecation warning**.

Latest backend check after purchase and restock: `.\.venv\Scripts\python.exe -m pytest -q --tb=short` on 25 October 2026 returned **87 passed, 1 dependency deprecation warning**.

## Screenshots

Pending the completed application. Add genuine screenshots during final verification.

## My AI Usage

Codex helped plan the architecture and create the initial project foundation. As later milestones are completed, document the exact tools used, how they helped, what was manually reviewed or changed, and a personal reflection on their effect on the workflow. Raw transcripts or public chat links belong in root `PROMPTS.md`.

## Repository

Public repository URL: https://github.com/AkshdeepSingh2006/car-dealership-inventory

