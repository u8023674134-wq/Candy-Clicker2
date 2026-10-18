"""Candy Clicker — бот + Mini App."""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api import router as api_router
from config import settings
from database import db
from handlers import router as start_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("clicker")

ROOT = Path(__file__).parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    log.info("Database connected")
    yield
    await db.close()


web_app = FastAPI(title="Candy Clicker", lifespan=lifespan)
web_app.include_router(api_router)

# PNG лежат в корне репо → отдаём их как /assets/имя.png
web_app.mount("/assets", StaticFiles(directory=str(ROOT)), name="assets")


@web_app.get("/")
async def index():
    return FileResponse(ROOT / "index.html")


@web_app.get("/style.css")
async def style():
    return FileResponse(ROOT / "style.css", media_type="text/css")


@web_app.get("/game.js")
async def game_js():
    return FileResponse(ROOT / "game.js", media_type="application/javascript")


@web_app.get("/health")
async def health():
    return {"ok": True}


async def run_bot() -> None:
    bot = Bot(token=settings.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(start_router)
    if db._conn is None:
        await db.connect()
    log.info("Bot starting (polling)...")
    await dp.start_polling(bot)


async def main() -> None:
    port = int(os.getenv("PORT", "8000"))
    config = uvicorn.Config(web_app, host="0.0.0.0", port=port, log_level="info", loop="asyncio")
    server = uvicorn.Server(config)
    bot_task = asyncio.create_task(run_bot())
    web_task = asyncio.create_task(server.serve())
    done, pending = await asyncio.wait([bot_task, web_task], return_when=asyncio.FIRST_EXCEPTION)
    for t in pending:
        t.cancel()
    for t in done:
        if t.exception():
            raise t.exception()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Stopped")
