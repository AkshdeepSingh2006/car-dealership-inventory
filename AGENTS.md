# Project instructions

Read `docs/DEVELOPMENT_PLAN.md` and the original assignment brief before changing this project. The assignment is the authoritative feature specification.

The user is learning and has two days for the assessment. Keep changes small and explain their purpose, relevant files, and verification in plain language. Do not add optional features or unrelated technologies.

For each business feature, follow Red-Green-Refactor as separate review stops: write and run failing tests first; implement the minimum behavior and rerun focused tests; then make only useful refactors and rerun tests. Do not weaken tests to pass. The user stages and commits; do not commit or push.

Before installing packages, show the exact command and explain it. Ask before any database-changing command, destructive operation, commit, push, or deployment. Never put credentials in source control or invent test results, screenshots, or AI logs. Remind the user to add the assignment's AI co-author trailer to AI-assisted commits.

Approved access rules: public registration creates regular users; every vehicle endpoint requires authentication; users can list, search, and purchase; admins alone can create, update, delete, and restock. The first admin comes from a controlled documented setup command, not public registration.

