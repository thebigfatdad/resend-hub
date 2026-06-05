"""FastAPI application entry point."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.webhooks import router as webhooks_router
from app.routes.threads import router as threads_router
from app.routes.transactional import router as transactional_router

app = FastAPI(
    title="bfd-support-hub API",
    description="Multi-brand customer support hub backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks_router)
app.include_router(threads_router)
app.include_router(transactional_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
