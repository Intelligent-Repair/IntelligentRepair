from typing import Optional

from app.db import supabase


def get_manual_for_vehicle(vehicle_id: str) -> Optional[str]:
    # Try to find a manual matching the vehicle_id in 'vehicle_manuals' or 'vehicle_manual' table
    for table in ("vehicle_manuals", "vehicle_manual"):
        data = supabase.select_all(table)
        if not data:
            continue
        for row in data:
            if str(row.get("vehicle_id")) == str(vehicle_id):
                return row.get("manual_text") or row.get("content") or row.get("text")
    return None
