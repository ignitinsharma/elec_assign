"""FastAPI application shared by local development and Vercel."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.schemas.health import HealthResponse

app = FastAPI(title="Day-ahead wind review API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Report that the API process is available."""
    return HealthResponse(status="ok")
