import logging

from app.db.supabase import SupabaseRestError, supabase_rest_request
from app.schemas.card import (
    CardCatalogItem, CardCatalogRead, CardCollectionRead, CardPurchaseResult, CardRead,
)

logger = logging.getLogger("zona_diamante.cards")


class ProfileNotFoundError(LookupError):
    pass


async def get_card_catalog() -> CardCatalogRead:
    """Public active catalog; never read profiles or inventory here."""
    teams = await supabase_rest_request("GET", "teams", params={
        "select": "id,slug,name", "is_active": "eq.true",
    })
    rows = await supabase_rest_request("GET", "cards", params={
        "select": "id,team_id,slug,name,description,image_path,card_type,cost,unlock_method",
        "is_active": "eq.true", "order": "id.asc",
    })
    if not isinstance(teams, list) or not isinstance(rows, list):
        raise SupabaseRestError(502, "Invalid catalog response.")
    teams_by_id = {int(team["id"]): team for team in teams}
    cards = []
    for row in rows:
        team = teams_by_id.get(int(row["team_id"]))
        if team is None:
            logger.warning("card_team_missing card_id=%s team_id=%s", row["id"], row["team_id"])
            continue
        cards.append(CardCatalogItem(
            **row, team_slug=team["slug"], team_name=team["name"],
        ))
    return CardCatalogRead(total_cards=len(cards), cards=cards)


async def get_collection_for_user(user_id: str) -> CardCollectionRead:
    profile_data = await supabase_rest_request("GET", "profiles", params={
        "select": "points_balance", "id": f"eq.{user_id}", "limit": "1",
    })
    if not isinstance(profile_data, list) or not profile_data:
        raise ProfileNotFoundError("Profile not found.")
    catalog = await get_card_catalog()
    owned_data = await supabase_rest_request("GET", "user_cards", params={
        "select": "card_id,source,unlocked_at", "user_id": f"eq.{user_id}",
    })
    if not isinstance(owned_data, list):
        raise SupabaseRestError(502, "Invalid inventory response.")
    owned_by_id = {int(row["card_id"]): row for row in owned_data}
    cards = []
    for card in catalog.cards:
        owned = owned_by_id.get(card.id)
        cards.append(CardRead(**card.model_dump(), is_owned=owned is not None,
                              source=owned.get("source") if owned else None,
                              unlocked_at=owned.get("unlocked_at") if owned else None))
    return CardCollectionRead(points_balance=int(profile_data[0]["points_balance"]),
                              total_cards=len(cards), owned_cards=sum(card.is_owned for card in cards),
                              cards=cards)


async def purchase_card_for_user(
    *,
    user_id: str,
    card_id: int,
    idempotency_key: str,
) -> CardPurchaseResult:
    # ========================================================
    # Basic validation before calling PostgreSQL
    # ========================================================

    if card_id <= 0:
        raise ValueError(
            "card_id must be greater than zero."
        )

    idempotency_key = (
        idempotency_key.strip()
    )

    if (
        not idempotency_key
        or len(idempotency_key) > 128
    ):
        raise ValueError(
            "idempotency_key must contain "
            "between 1 and 128 characters."
        )


    # ========================================================
    # Atomic purchase in PostgreSQL
    # ========================================================

    data = await supabase_rest_request(
        "POST",
        "rpc/purchase_card",
        json={
            "p_user_id": user_id,
            "p_card_id": card_id,
            "p_idempotency_key": (
                idempotency_key
            ),
        },
    )

    result = (
        CardPurchaseResult.model_validate(
            data
        )
    )

    logger.info(
        "card_purchase_processed "
        "user_id=%s card_id=%s "
        "already_processed=%s",
        user_id,
        card_id,
        result.already_processed,
    )

    return result
