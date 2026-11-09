from uuid import UUID

from app.db.supabase import supabase_rest_request
from app.schemas.game_buffered import BufferedRead
from app.services.game_beta import RULES, InvalidBetaKey


async def command(user_id: str, action: str, *, game_id: UUID | None = None,
                  key: str | None = None, events: list[dict] | None = None) -> BufferedRead:
    if key is not None and not 1 <= len(key.strip()) <= 128:
        raise InvalidBetaKey('Idempotency-Key must contain 1 to 128 characters.')
    body = {'p_user_id': user_id, 'p_action': action,
            'p_attempt_id': str(game_id) if game_id else None,
            'p_key': key.strip() if key else None, 'p_events': events}
    if action == 'start':
        body['p_rules'] = RULES
    result = await supabase_rest_request('POST', 'rpc/game_buffered_command', json=body)
    return BufferedRead.model_validate(result)
