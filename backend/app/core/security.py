"""
安全工具模块
"""
import base64
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from cryptography.fernet import Fernet

from app.core.config import settings


def _get_fernet_key() -> bytes:
    """从配置获取Fernet密钥，确保是有效的32字节URL-safe base64格式"""
    key_str = settings.ENCRYPTION_KEY
    if len(key_str) == 44:
        return key_str.encode()
    key_bytes = hashlib.sha256(key_str.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)


ENCRYPTION_KEY = _get_fernet_key()
fernet = Fernet(ENCRYPTION_KEY)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def encrypt_api_key(api_key: str) -> str:
    return fernet.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    return fernet.decrypt(encrypted_key.encode()).decode()


security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return {"username": username}
    except JWTError:
        raise credentials_exception
