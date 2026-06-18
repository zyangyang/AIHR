"""
Dashboard统计API
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.db.session import get_db
from app.schemas import ApiResponse
from app.core.security import get_current_user
from app.models import Job, Resume

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=ApiResponse)
def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 活跃职位数
    active_jobs = db.query(func.count(Job.id)).filter(Job.status == "open").scalar() or 0

    # 今日投递数
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_applications = db.query(func.count(Resume.id)).filter(
        Resume.created_at >= today_start
    ).scalar() or 0

    # 待筛选简历数
    pending_resumes = db.query(func.count(Resume.id)).filter(
        Resume.status.in_(["new", "pending"])
    ).scalar() or 0

    # 待面试简历数
    interview_resumes = db.query(func.count(Resume.id)).filter(
        Resume.status == "interview"
    ).scalar() or 0

    return ApiResponse(data={
        "active_jobs": active_jobs,
        "today_applications": today_applications,
        "pending_resumes": pending_resumes,
        "interview_resumes": interview_resumes,
    })
