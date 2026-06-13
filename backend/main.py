from contextlib import asynccontextmanager
from pathlib import Path

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.logging import logger
from models.database import create_db_and_tables
from api import muses, websocket, research_agent, resources, knowledge, lessons, chat, voice, canvas


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.CHROMA_DB_PATH).mkdir(parents=True, exist_ok=True)
    Path(settings.FILES_PATH).mkdir(parents=True, exist_ok=True)

    create_db_and_tables()
    logger.info("Database ready")

    app.state.arq_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    logger.info(f"Storage backend: {settings.STORAGE_BACKEND}")
    logger.info(f"Vector store: {settings.VECTOR_STORE_BACKEND}")

    yield

    await app.state.arq_pool.aclose()
    logger.info("Shutting down")


app = FastAPI(title="Enlightingale API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(muses.router,           prefix="/api")
app.include_router(research_agent.router,  prefix="/api")
app.include_router(resources.router,       prefix="/api")
app.include_router(knowledge.router,       prefix="/api")
app.include_router(lessons.router,         prefix="/api")
app.include_router(canvas.router,          prefix="/api")
app.include_router(chat.router,            prefix="/api")
app.include_router(voice.router,           prefix="/api")
app.include_router(voice.router_ws)
app.include_router(websocket.router)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "storage": settings.STORAGE_BACKEND,
        "vector_store": settings.VECTOR_STORE_BACKEND,
        "database": settings.DATABASE_URL.split(":")[0],
    }
