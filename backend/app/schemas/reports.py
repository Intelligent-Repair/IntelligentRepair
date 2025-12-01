from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ReportCreate(BaseModel):
    vehicle_id: str
    description: str
    image_url: Optional[str] = None


class ReportResponse(BaseModel):
    id: str
    user_id: str
    vehicle_id: str
    description: str
    image_url: Optional[str] = None
    status: Optional[str] = "open"
    ai_summary: Optional[str] = None
    created_at: Optional[datetime] = None


class ReportListResponse(BaseModel):
    reports: List[ReportResponse]
