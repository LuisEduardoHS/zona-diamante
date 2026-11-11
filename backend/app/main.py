from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.me import router as me_router
from app.core.config import settings
from app.core.http_client import http_lifespan
from app.api.routes.attempts import router as attempts_router
from app.api.routes.rewards import router as rewards_router
from app.core.logging_config import configure_logging
from app.api.routes.trivia import router as trivia_router
from app.api.routes.cards import router as cards_router
from app.api.routes.games import router as games_router
from app.api.routes.game_beta import router as game_beta_router
from app.api.routes.game_buffered import router as game_buffered_router
from app.api.routes.email_notifications import router as email_notifications_router
from app.api.routes.ar import router as ar_router
from app.api.routes.matches import router as matches_router
from app.api.routes.feedback import router as feedback_router

configure_logging()

app = FastAPI(
    title="Zona Diamante API",
    version="0.1.0",
    lifespan=http_lifespan,
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
app.include_router(trivia_router)
app.include_router(cards_router)
app.include_router(game_beta_router)
app.include_router(game_buffered_router)
app.include_router(email_notifications_router)
app.include_router(games_router)
app.include_router(ar_router)
app.include_router(matches_router)
app.include_router(feedback_router)


@app.get("/")
def root():
    return {
        "message": "Zona Diamante API"
    }
