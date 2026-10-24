import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app(frontend_origin: str | None = None) -> FastAPI:
    app = FastAPI(title="Car Dealership Inventory API")
    allowed_origin = frontend_origin or os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[allowed_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()

