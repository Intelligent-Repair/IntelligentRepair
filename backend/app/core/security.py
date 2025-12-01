from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings
from app.schemas.auth import UserResponse


ALGORITHM = "HS256"
_bearer = HTTPBearer()


def create_access_token(subject: str, data: Optional[Dict[str, Any]] = None, expires_delta: Optional[timedelta] = None) -> str:
    payload = {"sub": subject}
    if data:
        payload.update(data)
    expire = datetime.utcnow() + (expires_delta or timedelta(days=1))
    payload.update({"exp": expire})
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)
    return token


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> UserResponse:
    token = credentials.credentials
    data = decode_access_token(token)
    sub = data.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    email = data.get("email")
    user = UserResponse(id=sub, email=email or sub)
    return user

