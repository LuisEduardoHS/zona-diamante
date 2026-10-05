import httpx

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.schemas.auth import CurrentUser

bearer_scheme = HTTPBearer(auto_error=False)

def unauthorized_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise unauthorized_exception()

    if credentials.scheme.lower() != "bearer":
        raise unauthorized_exception()

    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service is not configured.",
        )

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"

    headers = {
        "apikey": settings.supabase_publishable_key,
        "Authorization": f"Bearer {credentials.credentials}",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, headers=headers)
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable.",
        )

    if response.status_code != status.HTTP_200_OK:
        raise unauthorized_exception()

    data = response.json()

    user_id = data.get("id")

    if not user_id:
        raise unauthorized_exception()

    return CurrentUser(
        id=user_id,
        email=data.get("email"),
    )