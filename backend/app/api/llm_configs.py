"""
大模型配置API
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import ApiResponse
from app.core.security import get_current_user, encrypt_api_key
from app.models import LLMConfig, TokenUsageLog

router = APIRouter(prefix="/llm-configs", tags=["大模型配置"])


def _ensure_single_active_embedding(db: Session, exclude_id: int = None):
    """确保只有一个 active 的 embedding 配置"""
    active_embeddings = db.query(LLMConfig).filter(
        LLMConfig.config_type == "embedding",
        LLMConfig.is_active == True,
    ).all()
    for emb in active_embeddings:
        if exclude_id and emb.id == exclude_id:
            continue
        emb.is_active = False
    db.commit()


@router.get("", response_model=ApiResponse)
def list_llm_configs(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    configs = db.query(LLMConfig).order_by(LLMConfig.created_at.desc()).all()
    return ApiResponse(data=[c.to_dict() for c in configs])


@router.post("", response_model=ApiResponse, status_code=201)
def create_llm_config(request: dict = Body(...), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(LLMConfig).filter(LLMConfig.name == request["name"]).first()
    if existing:
        existing.api_key_encrypted = encrypt_api_key(request["api_key"])
        existing.base_url = request["base_url"]
        existing.price_per_million_tokens = request.get("price_per_million_tokens")
        existing.is_active = request.get("is_active", True)
        existing.config_type = request.get("config_type", "chat")
        if existing.config_type == "embedding" and existing.is_active:
            _ensure_single_active_embedding(db, exclude_id=existing.id)
        db.commit()
        db.refresh(existing)
        return ApiResponse(data=existing.to_dict())

    config_type = request.get("config_type", "chat")
    is_active = request.get("is_active", True)

    # embedding 类型只允许一个 active
    if config_type == "embedding" and is_active:
        _ensure_single_active_embedding(db)

    config = LLMConfig(
        name=request["name"], provider=request["provider"], model_name=request["model_name"],
        api_key_encrypted=encrypt_api_key(request["api_key"]), base_url=request["base_url"],
        price_per_million_tokens=request.get("price_per_million_tokens"), is_active=is_active,
        config_type=config_type,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return ApiResponse(data=config.to_dict())


@router.put("/{config_id}", response_model=ApiResponse)
def update_llm_config(config_id: int, request: dict = Body(...), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    config.name = request["name"]
    config.provider = request["provider"]
    config.model_name = request["model_name"]
    if request.get("api_key"):
        config.api_key_encrypted = encrypt_api_key(request["api_key"])
    config.base_url = request["base_url"]
    config.price_per_million_tokens = request.get("price_per_million_tokens")
    config.is_active = request.get("is_active", True)
    config.config_type = request.get("config_type", "chat")

    # embedding 类型只允许一个 active
    if config.config_type == "embedding" and config.is_active:
        _ensure_single_active_embedding(db, exclude_id=config.id)

    db.commit()
    db.refresh(config)
    return ApiResponse(data=config.to_dict())


@router.delete("/{config_id}", response_model=ApiResponse)
def delete_llm_config(config_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    db.delete(config)
    db.commit()
    return ApiResponse(message="删除成功")


@router.get("/token-usage", response_model=ApiResponse)
def get_token_usage(start_date: str = Query(None), end_date: str = Query(None), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(TokenUsageLog)
    if start_date:
        query = query.filter(TokenUsageLog.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(TokenUsageLog.created_at <= datetime.fromisoformat(end_date))
    logs = query.all()

    total_tokens = sum(log.tokens_used for log in logs)
    total_cost = sum(log.estimated_cost or 0 for log in logs)

    by_function = {}
    for log in logs:
        if log.function_type not in by_function:
            by_function[log.function_type] = {"tokens": 0, "cost": 0}
        by_function[log.function_type]["tokens"] += log.tokens_used
        by_function[log.function_type]["cost"] += log.estimated_cost or 0

    by_day = {}
    for log in logs:
        date_str = log.created_at.strftime("%Y-%m-%d")
        if date_str not in by_day:
            by_day[date_str] = {"tokens": 0, "cost": 0}
        by_day[date_str]["tokens"] += log.tokens_used
        by_day[date_str]["cost"] += log.estimated_cost or 0

    return ApiResponse(data={
        "total_tokens": total_tokens, "total_cost": total_cost,
        "by_function": [{"function_type": k, "tokens": v["tokens"], "cost": v["cost"]} for k, v in by_function.items()],
        "by_day": [{"date": k, "tokens": v["tokens"], "cost": v["cost"]} for k, v in sorted(by_day.items())]
    })
