"""
应用配置
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME: str = "HR AI"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    SECRET_KEY: str | None = os.getenv("SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./hr_ai.db")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
    UPLOAD_DIR: Path = Path("uploads")
    # 用于加密API密钥的固定密钥，生产环境请通过环境变量配置
    ENCRYPTION_KEY: str | None = os.getenv("ENCRYPTION_KEY")
    # Embedding 配置（硅基流动）
    EMBEDDING_API_KEY: str = os.getenv("EMBEDDING_API_KEY", "")
    EMBEDDING_BASE_URL: str = os.getenv("EMBEDDING_BASE_URL", "https://api.siliconflow.cn/v1")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "Qwen/Qwen3-VL-Embedding-8B")
    # ChromaDB 向量数据库
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")


settings = Settings()


def validate_settings():
    """Validate that required settings are present. Call at startup."""
    errors = []
    if not settings.SECRET_KEY:
        errors.append("SECRET_KEY is not set. Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
    if not settings.ENCRYPTION_KEY:
        errors.append("ENCRYPTION_KEY is not set. Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
    if errors:
        raise RuntimeError("\n".join(["HR AI 启动失败：缺少必要的环境变量配置\n" + "-" * 40] + errors + ["\n" + "-" * 40 + "\n请复制 .env.example 为 .env 并填入上述配置。"]))


validate_settings()
