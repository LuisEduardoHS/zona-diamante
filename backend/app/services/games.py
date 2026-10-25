from uuid import UUID

from app.db.supabase import supabase_rest_request
from app.schemas.game import GameRead, GameTransition


GAME_SELECT = "id,game_state,game_revision,started_at,completed_at"


class InvalidGameKey(ValueError):
    pass


async def start_game(user_id: str, key: str, restart_of: UUID | None) -> GameRead:
    key = key.strip()
    if not key or len(key) > 128:
        raise InvalidGameKey("Idempotency-Key must contain 1 to 128 characters.")
    data = await supabase_rest_request(
        "POST", "rpc/start_game_attempt", json={
            "p_user_id": user_id,
            "p_request_key": key,
            "p_restart_of": str(restart_of) if restart_of else None,
        },
    )
    return GameRead.model_validate(data)


async def get_game(user_id: str, game_id: UUID) -> GameRead | None:
    data = await supabase_rest_request("GET", "activity_attempts", params={
        "select": GAME_SELECT,
        "id": f"eq.{game_id}",
        "user_id": f"eq.{user_id}",
        "activity_type": "eq.game",
        "game_state": "not.is.null",
        "limit": "1",
    })
    return GameRead.model_validate(data[0]) if data else None


async def transition_game(user_id: str, game_id: UUID, command: GameTransition) -> GameRead:
    data = await supabase_rest_request("POST", "rpc/transition_game_attempt", json={
        "p_user_id": user_id,
        "p_attempt_id": str(game_id),
        "p_action": command.action,
        "p_expected_revision": command.expected_revision,
    })
    return GameRead.model_validate(data)
