from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.health import router as health_router
from .api.runs import router as runs_router
from .api.scores import router as scores_router
from .config import get_settings
from .database import get_connection


def create_app(perform_startup_check: bool = True) -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if perform_startup_check:
            db = get_connection()
            try:
                with db.cursor() as cursor:
                    cursor.execute("SELECT 1")
            finally:
                db.close()
        yield

    app = FastAPI(title="Brain Games API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(scores_router)
    app.include_router(runs_router)
    return app


app = create_app()
