from pydantic import BaseModel
from typing import Optional


class DiagnosticsRequest(BaseModel):
    vehicle_id: str
    description: str
    image_url: Optional[str] = None


class DiagnosticsResponse(BaseModel):
    report_id: str
    ai_summary: str
    recommendation: Optional[str] = None
