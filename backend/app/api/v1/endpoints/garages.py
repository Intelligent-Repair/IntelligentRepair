from fastapi import APIRouter, HTTPException, status, Depends

from app.schemas.garages import GarageCreate, GarageResponse, GarageListResponse
from app.core.security import get_current_user
from app.schemas.auth import UserResponse
from app.services import garage_service

router = APIRouter()


@router.post("/", response_model=GarageResponse, status_code=status.HTTP_201_CREATED)
def create_garage(payload: GarageCreate, user: UserResponse = Depends(get_current_user)):
    created = garage_service.create_garage(payload.name, payload.address, payload.phone)
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create garage")
    return GarageResponse(**created)


@router.get("/", response_model=GarageListResponse)
def list_garages(user: UserResponse = Depends(get_current_user)):
    rows = garage_service.list_garages() or []
    return GarageListResponse(garages=[GarageResponse(**r) for r in rows])
