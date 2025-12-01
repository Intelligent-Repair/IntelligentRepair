from typing import Dict, Any, List, Optional

from app.db import supabase


def create_garage(name: str, address: Optional[str] = None, phone: Optional[str] = None) -> Dict[str, Any]:
    payload = {"name": name, "address": address, "phone": phone}
    created = supabase.insert("garages", payload)
    return created


def list_garages() -> List[Dict[str, Any]]:
    return supabase.select_all("garages") or []


def get_garage(garage_id: str) -> Optional[Dict[str, Any]]:
    data = supabase.select_all("garages") or []
    for g in data:
        if str(g.get("id")) == str(garage_id):
            return g
    return None
