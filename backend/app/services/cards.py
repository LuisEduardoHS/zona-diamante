import logging

from app.db.supabase import supabase_rest_request
from app.schemas.card import (
    CardCollectionRead,
    CardPurchaseResult,
    CardRead,
)


logger = logging.getLogger(
    "zona_diamante.cards"
)


class ProfileNotFoundError(LookupError):
    pass


async def get_collection_for_user(
    user_id: str,
) -> CardCollectionRead:
    # ========================================================
    # 1. Read the user's current points balance
    # ========================================================

    profile_data = await supabase_rest_request(
        "GET",
        "profiles",
        params={
            "select": "points_balance",
            "id": f"eq.{user_id}",
            "limit": "1",
        },
    )

    if (
        not isinstance(profile_data, list)
        or not profile_data
    ):
        raise ProfileNotFoundError(
            "Profile not found."
        )

    points_balance = int(
        profile_data[0]["points_balance"]
    )


    # ========================================================
    # 2. Load active teams
    # ========================================================

    teams_data = await supabase_rest_request(
        "GET",
        "teams",
        params={
            "select": "id,slug,name",
            "is_active": "eq.true",
        },
    )

    if not isinstance(teams_data, list):
        teams_data = []

    teams_by_id = {
        int(team["id"]): team
        for team in teams_data
    }


    # ========================================================
    # 3. Load the complete active card catalog
    # ========================================================

    cards_data = await supabase_rest_request(
        "GET",
        "cards",
        params={
            "select": (
                "id,team_id,slug,name,description,"
                "image_path,card_type,cost,"
                "unlock_method"
            ),
            "is_active": "eq.true",
            "order": "id.asc",
        },
    )

    if not isinstance(cards_data, list):
        cards_data = []


    # ========================================================
    # 4. Load the cards owned by this user
    # ========================================================

    owned_data = await supabase_rest_request(
        "GET",
        "user_cards",
        params={
            "select": (
                "card_id,source,unlocked_at"
            ),
            "user_id": f"eq.{user_id}",
        },
    )

    if not isinstance(owned_data, list):
        owned_data = []

    owned_by_card_id = {
        int(item["card_id"]): item
        for item in owned_data
    }


    # ========================================================
    # 5. Merge catalog + team + ownership information
    # ========================================================

    cards: list[CardRead] = []

    for card in cards_data:
        card_id = int(card["id"])
        team_id = int(card["team_id"])

        team = teams_by_id.get(team_id)

        if team is None:
            logger.warning(
                "card_team_missing "
                "card_id=%s team_id=%s",
                card_id,
                team_id,
            )
            continue

        owned = owned_by_card_id.get(card_id)

        cards.append(
            CardRead(
                id=card_id,
                team_id=team_id,
                team_slug=team["slug"],
                team_name=team["name"],
                slug=card["slug"],
                name=card["name"],
                description=card.get(
                    "description"
                ),
                image_path=card.get(
                    "image_path"
                ),
                card_type=card["card_type"],
                cost=int(card["cost"]),
                unlock_method=card[
                    "unlock_method"
                ],
                is_owned=owned is not None,
                source=(
                    owned.get("source")
                    if owned
                    else None
                ),
                unlocked_at=(
                    owned.get("unlocked_at")
                    if owned
                    else None
                ),
            )
        )


    # ========================================================
    # 6. Build collection response
    # ========================================================

    owned_cards = sum(
        1
        for card in cards
        if card.is_owned
    )

    return CardCollectionRead(
        points_balance=points_balance,
        total_cards=len(cards),
        owned_cards=owned_cards,
        cards=cards,
    )


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