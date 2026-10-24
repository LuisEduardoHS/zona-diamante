from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


CardType = Literal[
    "player",
    "mvp_player",
    "team",
    "mascot",
]

UnlockMethod = Literal[
    "points",
    "ar",
]


class CardRead(BaseModel):
    id: int

    team_id: int
    team_slug: str
    team_name: str

    slug: str
    name: str
    description: str | None = None
    image_path: str | None = None

    card_type: CardType
    cost: int
    unlock_method: UnlockMethod

    is_owned: bool

    source: str | None = None
    unlocked_at: datetime | None = None


class CardCollectionRead(BaseModel):
    points_balance: int

    total_cards: int
    owned_cards: int

    cards: list[CardRead]


class CardPurchaseResult(BaseModel):
    reward_id: UUID
    user_id: UUID

    card_id: int
    card_name: str
    card_slug: str

    points_delta: int
    points_balance: int

    already_processed: bool