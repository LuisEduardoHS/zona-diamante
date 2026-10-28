import os
import re

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok"
    }


@router.get('/version')
def deployed_version():
    """Public revision only, to verify the actual Render deployment."""
    revision = os.getenv('RENDER_GIT_COMMIT', '')
    return {'revision': revision if re.fullmatch(r'[0-9a-f]{40}', revision) else None}
