"""
简历API
"""
import os
import threading
import uuid
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime

from app.db.session import get_db
from app.schemas import ApiResponse
from app.core.security import get_current_user
from app.core.celery_app import is_celery_available
from app.models import Resume, Job, TokenUsageLog
from app.tasks import extract_text_from_file, parse_text_with_llm

router = APIRouter(prefix="/resumes", tags=["简历"])


@router.get("", response_model=ApiResponse)
def list_resumes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    job_id: int = Query(None),
    status: str = Query(None),
    parse_status: str = Query(None),
    keyword: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Resume).join(Job, Resume.job_id == Job.id, isouter=True)
    if job_id:
        query = query.filter(Resume.job_id == job_id)
    if status:
        query = query.filter(Resume.status == status)
    if parse_status:
        query = query.filter(Resume.parse_status == parse_status)
    if keyword:
        query = query.filter(or_(Resume.name.contains(keyword), Resume.phone.contains(keyword), Resume.email.contains(keyword)))
    if start_date:
        query = query.filter(Resume.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Resume.created_at <= datetime.fromisoformat(end_date))

    total = query.count()
    resumes = query.order_by(Resume.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [r.to_list_dict() for r in resumes]
    return ApiResponse(data={"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/{resume_id}", response_model=ApiResponse)
def get_resume(resume_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    return ApiResponse(data=resume.to_dict())


@router.post("/parse-file", response_model=ApiResponse)
async def parse_file(
    job_id: int = Form(...),
    resume: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """上传简历文件，创建记录并触发异步解析（用于单份导入自动填充）"""
    if not resume.filename or not resume.filename.lower().endswith(('.pdf', '.doc', '.docx')):
        raise HTTPException(status_code=400, detail="仅支持PDF/DOC/DOCX格式简历")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="职位不存在")

    content = await resume.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件大小不能超过10MB")

    # 保存文件
    upload_dir = Path("uploads/resumes") / datetime.now().strftime("%Y-%m")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_ext = os.path.splitext(resume.filename)[1]
    file_path = upload_dir / f"{uuid.uuid4()}{file_ext}"
    with open(file_path, "wb") as f:
        f.write(content)

    # 创建 Resume 记录（字段为空，等待异步解析回填）
    resume_record = Resume(
        job_id=job.id, name="", phone="", email="",
        employment_status="", expected_salary="",
        file_path=str(file_path), file_name=resume.filename, file_size=len(content),
        parse_status="pending"
    )
    db.add(resume_record)
    db.commit()
    db.refresh(resume_record)

    # 触发异步解析
    _trigger_parse_async(resume_record.id)

    return ApiResponse(data={"resume_id": resume_record.id, "parse_status": "pending"})


@router.put("/{resume_id}", response_model=ApiResponse)
def update_resume(
    resume_id: int,
    name: str = Form(None), phone: str = Form(None), email: str = Form(None),
    employment_status: str = Form(None), expected_salary: str = Form(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新简历信息（用于单份导入时修改 AI 填充的字段）"""
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    if name is not None:
        resume.name = name
    if phone is not None:
        resume.phone = phone
    if email is not None:
        resume.email = email
    if employment_status is not None:
        resume.employment_status = employment_status
    if expected_salary is not None:
        resume.expected_salary = expected_salary

    db.commit()
    db.refresh(resume)
    return ApiResponse(data=resume.to_dict())


@router.post("/batch-import", response_model=ApiResponse)
async def batch_import_resumes(
    job_id: int = Form(...),
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """批量导入简历：保存文件 + 创建记录 + 触发异步解析"""
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="单次最多导入50份简历")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="职位不存在")

    results = []
    success_count = 0
    failed_count = 0

    for file in files:
        try:
            if not file.filename or not file.filename.lower().endswith(('.pdf', '.doc', '.docx')):
                results.append({"file_name": file.filename or "未知", "status": "failed", "error": "仅支持PDF/DOC/DOCX格式"})
                failed_count += 1
                continue

            content = await file.read()
            if len(content) > 10 * 1024 * 1024:
                results.append({"file_name": file.filename, "status": "failed", "error": "文件大小超过10MB"})
                failed_count += 1
                continue

            # 保存文件
            upload_dir = Path("uploads/resumes") / datetime.now().strftime("%Y-%m")
            upload_dir.mkdir(parents=True, exist_ok=True)
            file_ext = os.path.splitext(file.filename)[1]
            file_path = upload_dir / f"{uuid.uuid4()}{file_ext}"
            with open(file_path, "wb") as f:
                f.write(content)

            # 创建 Resume 记录（字段为空，等待异步解析回填）
            resume_record = Resume(
                job_id=job.id, name="", phone="", email="",
                employment_status="", expected_salary="",
                file_path=str(file_path), file_name=file.filename, file_size=len(content),
                parse_status="pending"
            )
            db.add(resume_record)
            db.commit()
            db.refresh(resume_record)

            # 触发异步解析
            _trigger_parse_async(resume_record.id)

            results.append({"file_name": file.filename, "resume_id": resume_record.id, "status": "success"})
            success_count += 1
        except Exception as e:
            results.append({"file_name": file.filename or "未知", "status": "failed", "error": str(e)})
            failed_count += 1

    return ApiResponse(data={
        "total": len(files),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results,
    })


def _trigger_parse_async(resume_id: int):
    """触发异步解析（优先 Celery，回退到线程）"""
    if is_celery_available():
        try:
            from app.tasks import parse_resume_task
            parse_resume_task.delay(resume_id)
            return
        except Exception:
            pass

    # 回退：后台线程执行
    def _run():
        from app.tasks import parse_resume_task
        parse_resume_task.run(resume_id)

    threading.Thread(target=_run, daemon=True).start()


@router.post("/import", response_model=ApiResponse, status_code=201)
async def import_resume(
    name: str = Form(""), phone: str = Form(""), email: str = Form(""),
    employment_status: str = Form(""), expected_salary: str = Form(None),
    job_id: int = Form(...), resume: UploadFile = File(...),
    current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="职位不存在")
    if not resume.filename or not resume.filename.lower().endswith(('.pdf', '.doc', '.docx')):
        raise HTTPException(status_code=400, detail="仅支持PDF/DOC/DOCX格式简历")

    upload_dir = Path("uploads/resumes") / datetime.now().strftime("%Y-%m")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_ext = os.path.splitext(resume.filename)[1]
    file_path = upload_dir / f"{uuid.uuid4()}{file_ext}"

    content = await resume.read()
    with open(file_path, "wb") as f:
        f.write(content)

    resume_record = Resume(
        job_id=job.id, name=name, phone=phone, email=email,
        employment_status=employment_status, expected_salary=expected_salary,
        file_path=str(file_path), file_name=resume.filename, file_size=len(content),
        parse_status="pending"
    )
    db.add(resume_record)
    db.commit()
    db.refresh(resume_record)
    return ApiResponse(data=resume_record.to_dict())


@router.get("/{resume_id}/file")
def download_resume(resume_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    file_path = Path(resume.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="简历文件不存在")
    return FileResponse(path=str(file_path), filename=resume.file_name,
                       media_type="application/pdf" if resume.file_name.lower().endswith('.pdf') else "application/msword")


@router.patch("/{resume_id}/status", response_model=ApiResponse)
def update_resume_status(
    resume_id: int, request: dict = Body(...), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    resume.status = request["status"]
    if request.get("reject_reason"):
        resume.reject_reason = request["reject_reason"]
    db.commit()
    db.refresh(resume)
    return ApiResponse(data=resume.to_dict())
