from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class TicketCreate(BaseModel):
    report_id: str
    garage_id: str
    notes: Optional[str] = None


class TicketResponse(BaseModel):
    id: str
    report_id: str
    garage_id: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class TicketListResponse(BaseModel):
    tickets: List[TicketResponse]
