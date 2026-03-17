from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.middleware import unhandled_exception_middleware

setup_logging()

app = FastAPI(title=settings.app_name)
app.middleware('http')(unhandled_exception_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_v1_router, prefix='/api/v1')
