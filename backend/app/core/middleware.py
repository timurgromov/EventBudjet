import logging

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


async def unhandled_exception_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:  # pragma: no cover
        logger.exception('unhandled_exception path=%s', request.url.path)
        return JSONResponse(status_code=500, content={'detail': 'Internal Server Error'})
