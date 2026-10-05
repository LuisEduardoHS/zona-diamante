from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.me import router as me_router
from app.core.config import settings
from app.api.routes.attempts import router as attempts_router
from app.api.routes.rewards import router as rewards_router
from app.core.logging_config import configure_logging

configure_logging()

app = FastAPI(
    title="Zona Diamante API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


app.include_router(health_router)
app.include_router(me_router)
app.include_router(attempts_router)
app.include_router(rewards_router)


@app.get("/")
def root():
    return {
        "message": "Zona Diamante API"
    }