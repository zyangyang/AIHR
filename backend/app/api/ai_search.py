"""
AI 搜索 API - 基于 RAG 的简历语义搜索
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.schemas import ApiResponse
from app.core.security import get_current_user
from app.models import Resume
from app.services.vector_store import vector_store, _get_embedding_config

router = APIRouter(prefix="/ai-search", tags=["AI搜索"])


class AiSearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 10


@router.post("", response_model=ApiResponse)
def ai_search(
    request: AiSearchRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI 语义搜索简历"""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="搜索内容不能为空")

    results = vector_store.search(request.query, top_k=request.top_k, db_session=db)
    if not results:
        return ApiResponse(data={"items": [], "total": 0})

    items = []
    for item in results:
        resume = db.query(Resume).filter(Resume.id == item["resume_id"]).first()
        if resume:
            items.append({
                "resume": resume.to_list_dict(),
                "score": item["score"],
            })

    return ApiResponse(data={"items": items, "total": len(items)})


@router.post("/index", response_model=ApiResponse)
def build_index(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """触发全量索引构建（同步执行）"""
    emb_config = _get_embedding_config(db)
    if not emb_config:
        raise HTTPException(status_code=400, detail="Embedding 配置未找到，请在大模型管理中配置嵌入模型")

    result = vector_store.build_index(db)
    return ApiResponse(
        message=f"索引构建完成：成功 {result.get('success_count', 0)} 条，失败 {result.get('failed_count', 0)} 条",
        data=result,
    )


@router.get("/index/status", response_model=ApiResponse)
def get_index_status(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取索引状态"""
    indexed_count = vector_store.get_indexed_count()
    total_count = db.query(Resume).filter(Resume.parse_status == "success").count()
    return ApiResponse(data={
        "indexed_count": indexed_count,
        "total_count": total_count,
    })


@router.get("/embedding-config", response_model=ApiResponse)
def get_embedding_config(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前使用的 Embedding 配置信息"""
    emb_config = _get_embedding_config(db)
    if not emb_config:
        return ApiResponse(data={"configured": False})
    return ApiResponse(data={
        "configured": True,
        "config_name": emb_config["config_name"],
        "model_name": emb_config["model_name"],
        "base_url": emb_config["base_url"],
        "source": emb_config["source"],
    })
