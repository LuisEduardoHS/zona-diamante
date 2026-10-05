import httpx
import logging

from app.core.config import settings

logger = logging.getLogger(
    "zona_diamante.supabase"
)

class SupabaseRestError(RuntimeError):
    def __init__(
        self,
        status_code: int,
        detail: str = "Supabase REST request failed.",
    ):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


async def supabase_rest_request(
    method: str,
    path: str,
    *,
    params: dict | None = None,
    json: dict | list | None = None,
    headers: dict | None = None,
):
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise SupabaseRestError(
            503,
            "Supabase backend access is not configured.",
        )

    url = (
        f"{settings.supabase_url.rstrip('/')}"
        f"/rest/v1/{path.lstrip('/')}"
    )

    request_headers = {
        "apikey": settings.supabase_secret_key,
        "Accept": "application/json",
    }

    if headers:
        request_headers.update(headers)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.request(
                method=method,
                url=url,
                params=params,
                json=json,
                headers=request_headers,
            )
    except httpx.HTTPError as error:

        logger.error(
            "supabase_unreachable method=%s path=%s error_type=%s",
            method.upper(),
            path,
            type(error).__name__,
        )

        raise SupabaseRestError(
            503,
            "Could not connect to Supabase REST.",
        ) from error

    if not response.is_success:

        log_method = (
            logger.warning
            if response.status_code < 500
            else logger.error
        )

        log_method(
            "supabase_request_failed method=%s path=%s status=%s",
            method.upper(),
            path,
            response.status_code,
        )

        detail = "Supabase REST request failed."

        try:
            data = response.json()

            if isinstance(data, dict):
                detail = (
                    data.get("message")
                    or data.get("hint")
                    or detail
                )
        except ValueError:
            pass

        raise SupabaseRestError(
            response.status_code,
            detail,
        )

    if response.status_code == 204 or not response.content:
        return None

    return response.json()