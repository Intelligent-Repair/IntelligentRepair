from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from uuid import uuid4
from typing import Optional

from app.schemas.reports import ReportResponse, ReportListResponse
from app.schemas.auth import UserResponse
from app.core.security import get_current_user
from app.services import report_service
from app.core.config import settings
from app.db.supabase import upload_file

router = APIRouter()


@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    vehicle_id: str = Form(...),
    description: str = Form(...),
    image: Optional[UploadFile] = File(None),
    user: UserResponse = Depends(get_current_user),
):
    image_url = None
    if image:
        if not settings.REPORTS_BUCKET:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="REPORTS_BUCKET is not configured")
        # create a path like: user_id/uuid_filename
        filename = f"{user.id}/{uuid4().hex}_{image.filename}"
        public_url = upload_file(settings.REPORTS_BUCKET, filename, image)
        if not public_url:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to upload image")
        image_url = public_url

    r = report_service.create_report(user.id, vehicle_id, description, image_url)
    if not r:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create report")
    return ReportResponse(**r)


@router.get("/", response_model=ReportListResponse)
def list_reports(user: UserResponse = Depends(get_current_user)):
    rows = report_service.list_reports(user.id)
    return ReportListResponse(reports=[ReportResponse(**r) for r in rows])
