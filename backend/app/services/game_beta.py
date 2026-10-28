import json
from pathlib import Path
from uuid import UUID

from app.db.supabase import supabase_rest_request
from app.schemas.game_beta import BetaRead

RULES = json.loads((Path(__file__).parents[1] / 'core/game_beta_rules.json').read_text(encoding='utf-8'))


class InvalidBetaKey(ValueError):
    pass


async def command(user_id: str, action: str, *, game_id: UUID | None = None,
                  key: str | None = None, mode: str | None = None,
                  revision: int | None = None, pitch_id: UUID | None = None,
                  probe: UUID | None = None) -> BetaRead | None:
    if key is not None and not 1 <= len(key.strip()) <= 128:
        raise InvalidBetaKey('Idempotency-Key must contain 1 to 128 characters.')
    body = {'p_user_id': user_id, 'p_action': action, 'p_attempt_id': str(game_id) if game_id else None,
            'p_key': key.strip() if key else None, 'p_mode': mode, 'p_revision': revision,
            'p_pitch_id': str(pitch_id) if pitch_id else None, 'p_probe': str(probe) if probe else None}
    if action == 'start':
        body['p_rules'] = RULES
    result = await supabase_rest_request('POST', 'rpc/game_beta_command', json=body)
    return BetaRead.model_validate(result) if result else None
