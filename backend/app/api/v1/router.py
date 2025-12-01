from fastapi import APIRouter

from app.api.v1.endpoints import auth
from app.api.v1.endpoints import vehicles, reports, diagnostics, garages, tickets

router = APIRouter()


@router.get("/health")
async def health():
	return {"status": "ok"}


router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"])
router.include_router(reports.router, prefix="/reports", tags=["reports"])
router.include_router(diagnostics.router, prefix="/diagnostics", tags=["diagnostics"])
router.include_router(garages.router, prefix="/garages", tags=["garages"])
router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
