from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.vehicles import VehicleCreate, VehicleResponse, VehicleListResponse
from app.schemas.auth import UserResponse
from app.core.security import get_current_user
from app.db import supabase

router = APIRouter()


@router.get("/", response_model=VehicleListResponse)
def list_vehicles(user: UserResponse = Depends(get_current_user)):
    data = supabase.select_all("vehicles")
    # Filter by user_id
    user_vehicles = [v for v in (data or []) if v.get("user_id") == user.id]
    vehicles = [VehicleResponse(**v) for v in user_vehicles]
    return VehicleListResponse(vehicles=vehicles)


@router.post("/", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VehicleCreate, user: UserResponse = Depends(get_current_user)):
    record = payload.dict()
    record["user_id"] = user.id
    created = supabase.insert("vehicles", record)
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create vehicle")
    return VehicleResponse(**created)
