"""FastAPI application shared by local development and Vercel."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.analytics import router as analytics_router
from app.schemas.health import HealthResponse
from app.services.snapshot import Snapshot, load_snapshot


def create_app(snapshot: Snapshot | None = None) -> FastAPI:
    """Build an app with an in-memory snapshot; tests may inject a fixture."""
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        application.state.snapshot = snapshot if snapshot is not None else load_snapshot()
        yield

    application = FastAPI(title="Day-ahead wind review API", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    application.include_router(analytics_router)

    @application.get("/api/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        """Report that the API process is available."""
        return HealthResponse(status="ok")

    return application


app = create_app()
