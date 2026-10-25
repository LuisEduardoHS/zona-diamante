from typing import Literal

from pydantic import BaseModel


class ARMascotRead(BaseModel):
    team_slug: str
    team_name: str
    card_id: int
    card_slug: str
    card_name: str
    is_owned: bool
    status: Literal["owned", "verification_required"]
    browser_claim_enabled: Literal[False] = False


class ARInventoryRead(BaseModel):
    mascots: list[ARMascotRead]
