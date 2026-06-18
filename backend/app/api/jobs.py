"""
职位API
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
import json

from app.db.session import get_db
from app.schemas import ApiResponse
from app.core.security import get_current_user
from app.models import Job, Resume

router = APIRouter(prefix="/jobs", tags=["职位"])


@router.get("", response_model=ApiResponse)
def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    keyword: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Job)
    if status:
        query = query.filter(Job.status == status)
    if keyword:
        query = query.filter(Job.title.contains(keyword))

    total = query.count()
    jobs = query.order_by(Job.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # 使用子查询一次性统计所有职位的简历数量
    resume_count_subq = (
        db.query(Resume.job_id, func.count(Resume.id).label("cnt"))
        .group_by(Resume.job_id)
        .subquery()
    )
    counts = db.query(resume_count_subq.c.job_id, resume_count_subq.c.cnt).all()
    count_map = {row.job_id: row.cnt for row in counts}

    items = []
    for job in jobs:
        items.append(job.to_list_dict(resume_count=count_map.get(job.id, 0)))

    return ApiResponse(data={"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/{job_id}", response_model=ApiResponse)
def get_job(job_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="职位不存在")
    return ApiResponse(data=job.to_dict())


@router.post("", response_model=ApiResponse, status_code=201)
def create_job(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    job = Job(
        title=request["title"],
        category=request.get("category"),
        location=request.get("location", ""),
        salary_range=request.get("salary_range"),
        description=request.get("description", ""),
        hard_requirements=json.dumps(request.get("hard_requirements")) if request.get("hard_requirements") else None,
        status=request.get("status", "draft"),
        apply_token=str(uuid.uuid4())
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return ApiResponse(data=job.to_dict())


@router.put("/{job_id}", response_model=ApiResponse)
def update_job(
    job_id: int,
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="职位不存在")

    for key, value in request.items():
        if value is not None:
            if key == "hard_requirements" and isinstance(value, (dict, list)):
                value = json.dumps(value)
            setattr(job, key, value)

    db.commit()
    db.refresh(job)
    return ApiResponse(data=job.to_dict())


@router.delete("/{job_id}", response_model=ApiResponse)
def delete_job(
    job_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="职位不存在")
    db.delete(job)
    db.commit()
    return ApiResponse(message="删除成功")


@router.patch("/{job_id}/status", response_model=ApiResponse)
def update_job_status(
    job_id: int,
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="职位不存在")
    job.status = request["status"]
    db.commit()
    db.refresh(job)
    return ApiResponse(data=job.to_dict())
