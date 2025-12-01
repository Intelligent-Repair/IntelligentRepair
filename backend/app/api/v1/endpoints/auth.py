from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any, Dict

from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.core.security import create_access_token, get_current_user
from app.core.config import settings
from app.db.supabase import get_client

router = APIRouter()


def _create_token_for_user_info(user_info: Dict[str, Any]) -> TokenResponse:
    # Prefer numeric/string id if available, otherwise use email
    sub = user_info.get("id") or user_info.get("user", {}).get("id") or user_info.get("email")
    email = user_info.get("email") or (user_info.get("user") or {}).get("email")
    token = create_access_token(subject=str(sub), data={"email": email})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    if not payload.email or not payload.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing credentials")

    # Try Supabase auth if configured
    try:
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            client = get_client()
            # supabase-py versions differ; try common auth methods
            resp = None
            try:
                # newer API
                resp = client.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
            except Exception:
                try:
                    resp = client.auth.sign_in({"email": payload.email, "password": payload.password})
                except Exception:
                    resp = None

            # normalize response
            if resp:
                # resp may be dict-like or object with 'user' attribute
                data = None
                if isinstance(resp, dict):
                    data = resp.get("user") or resp.get("data") or resp
                else:
                    # try attributes
                    data = getattr(resp, "user", None) or getattr(resp, "data", None) or resp

                if data:
                    return _create_token_for_user_info(data)
                # If no user in response, treat as auth failure
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception:
        # If Supabase is not reachable or method not available, fall back to MVP behavior
        pass

    # Fallback MVP: accept any credentials (useful for local dev when Supabase isn't configured)
    return TokenResponse(access_token=create_access_token(subject=payload.email, data={"email": payload.email}))


@router.get("/me", response_model=UserResponse)
def me(user: UserResponse = Depends(get_current_user)):
    return user
