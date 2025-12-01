from pydantic import BaseModel
from typing import List, Optional


class GarageCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None


class GarageResponse(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None


class GarageListResponse(BaseModel):
    garages: List[GarageResponse]
