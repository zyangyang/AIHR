"""
提示词API
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import ApiResponse
from app.core.security import get_current_user
from app.models import Prompt, PromptVersion

router = APIRouter(prefix="/prompts", tags=["提示词"])


@router.get("", response_model=ApiResponse)
def list_prompts(type: str = Query(None), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Prompt)
    if type:
        query = query.filter(Prompt.type == type)
    prompts = query.order_by(Prompt.created_at.desc()).all()
    return ApiResponse(data=[p.to_list_dict() for p in prompts])


@router.get("/{prompt_id}", response_model=ApiResponse)
def get_prompt(prompt_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    versions = [{"version": v.version, "content": v.content, "created_at": v.created_at.isoformat() if v.created_at else None} for v in prompt.versions]
    return ApiResponse(data={
        "id": prompt.id, "name": prompt.name, "type": prompt.type, "content": prompt.content,
        "is_system_default": prompt.is_system_default, "current_version": prompt.current_version,
        "usage_count": prompt.usage_count, "versions": versions,
        "created_at": prompt.created_at.isoformat() if prompt.created_at else None,
        "updated_at": prompt.updated_at.isoformat() if prompt.updated_at else None
    })


@router.post("", response_model=ApiResponse, status_code=201)
def create_prompt(request: dict = Body(...), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = Prompt(name=request["name"], type=request["type"], content=request["content"], is_system_default=False, current_version=1)
    db.add(prompt)
    db.flush()
    db.add(PromptVersion(prompt_id=prompt.id, version=1, content=request["content"]))
    db.commit()
    db.refresh(prompt)
    return ApiResponse(data=prompt.to_dict())


@router.put("/{prompt_id}", response_model=ApiResponse)
def update_prompt(prompt_id: int, request: dict = Body(...), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    if prompt.is_system_default and request.get("name"):
        raise HTTPException(status_code=400, detail="系统预置提示词仅允许更新内容")
    if "content" in request and request["content"]:
        new_version = prompt.current_version + 1
        db.add(PromptVersion(prompt_id=prompt_id, version=new_version, content=request["content"]))
        prompt.current_version = new_version
    if "name" in request and request["name"]:
        prompt.name = request["name"]
    db.commit()
    db.refresh(prompt)
    return ApiResponse(data=prompt.to_dict())


@router.delete("/{prompt_id}", response_model=ApiResponse)
def delete_prompt(prompt_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    if prompt.is_system_default:
        raise HTTPException(status_code=400, detail="系统预置提示词不可删除")
    db.delete(prompt)
    db.commit()
    return ApiResponse(message="删除成功")
