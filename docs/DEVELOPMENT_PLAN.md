# Development plan

## Source of truth

The three-page `Incubyte-Assignment.pdf` supplied by the user is authoritative. This plan records approved implementation decisions and the order of work. The project uses FastAPI, PostgreSQL, React, TypeScript, Vite, Tailwind CSS, pytest/HTTPX, and Vitest/React Testing Library.

## Approved decisions

- PostgreSQL databases are intended to be `car_dealership_dev` and `car_dealership_test`, managed by the user through pgAdmin. pgAdmin is a client; the PostgreSQL server supplies the actual connection.
- Database credentials come from untracked environment files. Never commit real secrets.
- Public registration always creates a regular user. All vehicle routes require a token. Regular users can list, search, and purchase. Admins can additionally create, update, delete, and restock.
- The initial admin is created by a controlled setup command that will be designed and documented during the authentication milestone. Public registration never grants admin status.
- The backend owns validation, permissions, and stock changes. Frontend controls improve usability but are not a security boundary.
- Deployment is optional. A complete local application and required documentation take priority.

## Milestones and review stops

1. **Foundation:** project structure, package manifests, minimal app entry points, environment examples, test harnesses, and documentation. No business logic or database changes.
2. **Registration:** RED tests for valid/invalid/duplicate registration and password hashing; GREEN endpoint and persistence; REFACTOR only if useful.
3. **Login and authorization:** RED tests for credentials, JWT, missing/invalid tokens, user/admin rules, and controlled admin creation; then GREEN and optional REFACTOR.
4. **Vehicles:** RED tests for creation, list, validation, persistence, and authorization; then GREEN and optional REFACTOR.
5. **Search:** RED tests for make, model, category, price range, combinations, and empty results; then GREEN and optional REFACTOR.
6. **Update and delete:** RED tests for edits, invalid data, missing IDs, and admin permission; then GREEN and optional REFACTOR.
7. **Purchase and restock:** RED tests for stock changes, zero stock, missing IDs, admin permission, and concurrent purchases; then GREEN and optional REFACTOR. Stock must never become negative.
8. **Frontend:** registration/login, vehicle browsing/filtering/purchase, and admin management. Add meaningful component tests and check responsive behavior.
9. **Delivery:** run full suites, record real output, capture real application screenshots, finish README and raw AI usage records, and publish the repository with user approval.

For each business milestone, stop after RED and GREEN so the user can review and commit. Suggest descriptive messages; the user handles staging and commits. AI-assisted commits need the assignment's `Co-authored-by` trailer after two blank lines.

## Documentation checklist

- README: project explanation, backend/frontend setup, environment variables, screenshots, actual test report, and detailed `My AI Usage` reflection.
- Root `PROMPTS.md`: raw, unedited chat logs or public chat links only. Do not substitute generated summaries.
- Public Git repository URL in the final README/delivery.

