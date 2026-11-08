from typing import Literal

from pydantic import BaseModel, ConfigDict


class ARMascotRead(BaseModel):
    team_slug: str
    team_name: str
    card_id: int
    card_slug: str
    card_name: str
    is_owned: bool
    status: Literal["owned", "claimable"]
    browser_claim_enabled: bool = True


class ARInventoryRead(BaseModel):
    mascots: list[ARMascotRead]


class ARClaimRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    team_slug: Literal['algodoneros-ul', 'charros-jal', 'dorados-chi', 'sultanes-mty']


class ARClaimRead(BaseModel):
    mascot: ARMascotRead
    already_owned: bool
    already_processed: bool
