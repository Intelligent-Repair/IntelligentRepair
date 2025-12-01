from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.diagnostics import DiagnosticsRequest, DiagnosticsResponse
from app.schemas.auth import UserResponse
from app.core.security import get_current_user
from app.services import manual_service, openai_service, report_service

router = APIRouter()


@router.post("/", response_model=DiagnosticsResponse)
def run_diagnostics(payload: DiagnosticsRequest, user: UserResponse = Depends(get_current_user)):
    # 1. create basic report and fetch manual
    manual_text = manual_service.get_manual_for_vehicle(payload.vehicle_id)

    # 2. call OpenAI service to generate diagnosis
    ai_summary = openai_service.generate_diagnosis(manual_text, payload.description, payload.image_url)

    # 3. persist report + AI summary
    report = report_service.create_report_with_diagnostics(user.id, payload.vehicle_id, payload.description, payload.image_url, manual_text or "", ai_summary)
    if not report:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create diagnostic report")

    return DiagnosticsResponse(report_id=report.get("id"), ai_summary=ai_summary)
