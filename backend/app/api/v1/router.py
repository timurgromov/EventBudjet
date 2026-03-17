from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.lead import router as lead_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(health_router)
router.include_router(lead_router)
