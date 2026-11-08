from app.db.supabase import SupabaseRestError, supabase_rest_request
from app.schemas.ar import ARInventoryRead, ARMascotRead, ARClaimRead


async def get_ar_inventory(user_id: str) -> ARInventoryRead:
    teams = await supabase_rest_request("GET", "teams", params={
        "select": "id,slug,name", "is_active": "eq.true",
    })
    cards = await supabase_rest_request("GET", "cards", params={
        "select": "id,team_id,slug,name", "is_active": "eq.true",
        "card_type": "eq.mascot", "unlock_method": "eq.ar", "cost": "eq.0", "order": "id.asc",
    })
    inventory = await supabase_rest_request("GET", "user_cards", params={
        "select": "card_id", "user_id": f"eq.{user_id}",
    })
    teams_by_id = {row["id"]: row for row in teams}
    owned = {row["card_id"] for row in inventory}
    seen = set()
    mascots = []
    for card in cards:
        team = teams_by_id.get(card["team_id"])
        if team is None:
            continue
        if team["id"] in seen:
            raise SupabaseRestError(502, "Ambiguous AR catalog.")
        seen.add(team["id"])
        is_owned = card["id"] in owned
        mascots.append(ARMascotRead(
            team_slug=team["slug"], team_name=team["name"],
            card_id=card["id"], card_slug=card["slug"], card_name=card["name"],
            is_owned=is_owned, status="owned" if is_owned else "claimable",
        ))
    return ARInventoryRead(mascots=mascots)


async def claim_ar_mascot(user_id: str, team_slug: str) -> ARClaimRead:
    inventory = await get_ar_inventory(user_id)
    mascot = next((row for row in inventory.mascots if row.team_slug == team_slug), None)
    if mascot is None:
        raise ValueError('La carta AR de este equipo no está disponible.')
    if mascot.is_owned:
        return ARClaimRead(mascot=mascot, already_owned=True, already_processed=True)

    # Product policy: authenticated, self-service AR collectibles. Local logo
    # recognition is NOT proof of physical presence. The server authorizes only
    # the catalog mascot, never client-provided card IDs, balances or points.
    # A stable reference/key makes retries and concurrent claims one operation.
    reference = f'ar-self-service:v1:{user_id}:{team_slug}'
    attempt_id = await supabase_rest_request('POST', 'rpc/authorize_ar_mascot', json={
        'p_user_id': user_id, 'p_team_slug': team_slug, 'p_verification_ref': reference,
    })
    result = await supabase_rest_request('POST', 'rpc/grant_verified_ar_mascot', json={
        'p_user_id': user_id, 'p_attempt_id': attempt_id, 'p_request_key': reference,
    })
    if (not isinstance(result, dict) or result.get('card_id') != mascot.card_id
            or not isinstance(result.get('already_owned'), bool)
            or not isinstance(result.get('already_processed'), bool)):
        raise SupabaseRestError(502, 'Invalid AR grant result.')
    return ARClaimRead(mascot=mascot.model_copy(update={'is_owned': True, 'status': 'owned'}),
                       already_owned=result['already_owned'], already_processed=result['already_processed'])
