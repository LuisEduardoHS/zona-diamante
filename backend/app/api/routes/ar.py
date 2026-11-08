from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.ar import ARInventoryRead, ARClaimRequest, ARClaimRead
from app.schemas.auth import CurrentUser
from app.services.ar import get_ar_inventory, claim_ar_mascot


router = APIRouter(prefix="/api/v1/ar", tags=["ar"])


@router.get("/mascots", response_model=ARInventoryRead)
async def read_ar_mascots(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> ARInventoryRead:
    try:
        return await get_ar_inventory(current_user.id)
    except SupabaseRestError as error:
        raise HTTPException(status_code=502, detail="Could not retrieve AR inventory.") from error

@router.post('/claim', response_model=ARClaimRead)
async def claim_mascot(body: ARClaimRequest,
                       current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> ARClaimRead:
    try:
        return await claim_ar_mascot(current_user.id, body.team_slug)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except SupabaseRestError as error:
        raise HTTPException(status_code=502, detail='No pudimos confirmar tu carta AR. Inténtalo de nuevo.') from error
