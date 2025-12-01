from pydantic import BaseModel
from typing import Optional, List


class VehicleCreate(BaseModel):
    manufacturer: str
    model: str
    year: int
    license_plate: Optional[str] = None


class VehicleResponse(BaseModel):
    id: str
    user_id: str
    manufacturer: str
    model: str
    year: int
    license_plate: Optional[str] = None


class VehicleListResponse(BaseModel):
    vehicles: List[VehicleResponse]
