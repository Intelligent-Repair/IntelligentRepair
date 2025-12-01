from typing import Dict, Any, List, Optional
from datetime import datetime

from app.db import supabase


def create_ticket(report_id: str, garage_id: str, notes: Optional[str] = None) -> Dict[str, Any]:
    payload = {
        "report_id": report_id,
        "garage_id": garage_id,
        "notes": notes,
        "created_at": datetime.utcnow().isoformat(),
    }
    created = supabase.insert("tickets", payload)
    return created


def list_tickets_for_garage(garage_id: str) -> List[Dict[str, Any]]:
    data = supabase.select_all("tickets") or []
    return [t for t in data if str(t.get("garage_id")) == str(garage_id)]


def list_tickets_for_report(report_id: str) -> List[Dict[str, Any]]:
    data = supabase.select_all("tickets") or []
    return [t for t in data if str(t.get("report_id")) == str(report_id)]
