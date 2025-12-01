from typing import List, Dict, Any, Optional
from datetime import datetime

from app.db import supabase


def create_report(user_id: str, vehicle_id: str, description: str, image_url: Optional[str] = None) -> Dict[str, Any]:
    payload = {
        "user_id": user_id,
        "vehicle_id": vehicle_id,
        "description": description,
        "image_url": image_url,
        "status": "open",
        "created_at": datetime.utcnow().isoformat(),
    }
    created = supabase.insert("reports", payload)
    return created


def list_reports(user_id: str) -> List[Dict[str, Any]]:
    data = supabase.select_all("reports")
    return [r for r in (data or []) if r.get("user_id") == user_id]


def update_report_ai_summary(report_id: str, ai_summary: str) -> Dict[str, Any]:
    updated = supabase.update("reports", "id", report_id, {"ai_summary": ai_summary})
    return updated


def create_report_with_diagnostics(user_id: str, vehicle_id: str, description: str, image_url: Optional[str], manual_text: str, ai_summary: str) -> Dict[str, Any]:
    report = create_report(user_id, vehicle_id, description, image_url)
    # Update with AI summary
    if report and report.get("id"):
        update_report_ai_summary(report.get("id"), ai_summary)
        report["ai_summary"] = ai_summary
    return report
