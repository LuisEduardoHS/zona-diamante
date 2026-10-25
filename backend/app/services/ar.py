from app.db.supabase import SupabaseRestError, supabase_rest_request
from app.schemas.ar import ARInventoryRead, ARMascotRead


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
            is_owned=is_owned, status="owned" if is_owned else "verification_required",
        ))
    return ARInventoryRead(mascots=mascots)
