"""
认证API
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import LoginRequest, LoginResponse, ChangePasswordRequest, ApiResponse
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user
from app.core.config import settings
from app.models import User

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=ApiResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)

    return ApiResponse(
        data=LoginResponse(access_token=access_token, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    )


@router.post("/change-password", response_model=ApiResponse)
def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == current_user["username"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if not verify_password(request.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="旧密码不正确")

    user.password_hash = get_password_hash(request.new_password)
    db.commit()

    return ApiResponse(message="密码修改成功")
