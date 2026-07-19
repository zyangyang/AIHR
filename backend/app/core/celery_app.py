"""
Celery异步任务配置
"""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "hr_ai_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
)


_celery_available: bool | None = None


def is_celery_available() -> bool:
    """检查 Celery broker (Redis) 是否可用，带 2 秒超时"""
    global _celery_available
    if _celery_available is not None:
        return _celery_available
    try:
        import redis as redis_lib
        r = redis_lib.from_url(settings.CELERY_BROKER_URL, socket_timeout=2, socket_connect_timeout=2)
        r.ping()
        r.close()
        _celery_available = True
    except Exception:
        _celery_available = False
    return _celery_available
