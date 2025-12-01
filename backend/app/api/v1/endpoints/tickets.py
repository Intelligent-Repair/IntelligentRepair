from fastapi import APIRouter, HTTPException, status, Depends

from app.schemas.tickets import TicketCreate, TicketResponse, TicketListResponse
from app.core.security import get_current_user
from app.schemas.auth import UserResponse
from app.services import ticket_service

router = APIRouter()


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketCreate, user: UserResponse = Depends(get_current_user)):
    created = ticket_service.create_ticket(payload.report_id, payload.garage_id, payload.notes)
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create ticket")
    return TicketResponse(**created)


@router.get("/garage/{garage_id}", response_model=TicketListResponse)
def list_tickets_for_garage(garage_id: str, user: UserResponse = Depends(get_current_user)):
    rows = ticket_service.list_tickets_for_garage(garage_id)
    return TicketListResponse(tickets=[TicketResponse(**r) for r in rows])


@router.get("/report/{report_id}", response_model=TicketListResponse)
def list_tickets_for_report(report_id: str, user: UserResponse = Depends(get_current_user)):
    rows = ticket_service.list_tickets_for_report(report_id)
    return TicketListResponse(tickets=[TicketResponse(**r) for r in rows])
