"""
向量数据库服务 - 基于 NumPy 的轻量级向量搜索
使用 OpenAI 兼容 API 生成嵌入向量，NumPy 计算余弦相似度，JSON 文件持久化存储。
"""
import json
import logging
import threading
from pathlib import Path
from typing import Optional

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

# 全局锁，保护文件读写
_db_lock = threading.Lock()


def _get_embedding_config(db_session=None) -> dict:
    """获取 Embedding 配置，优先从数据库读取，fallback 到 settings"""
    if db_session is not None:
        try:
            from app.models import LLMConfig
            from app.core.security import decrypt_api_key
            config = db_session.query(LLMConfig).filter(
                LLMConfig.config_type == "embedding",
                LLMConfig.is_active == True,
            ).first()
            if config:
                return {
                    "api_key": decrypt_api_key(config.api_key_encrypted),
                    "base_url": config.base_url,
                    "model_name": config.model_name,
                    "config_name": config.name,
                    "source": "database",
                }
        except Exception as e:
            logger.warning(f"从数据库读取 Embedding 配置失败，fallback 到 .env: {e}")

    # fallback 到 settings
    if settings.EMBEDDING_API_KEY:
        return {
            "api_key": settings.EMBEDDING_API_KEY,
            "base_url": settings.EMBEDDING_BASE_URL,
            "model_name": settings.EMBEDDING_MODEL,
            "config_name": f"{settings.EMBEDDING_MODEL}（.env）",
            "source": "env",
        }

    return None


def _build_resume_text(parsed_data: dict) -> str:
    """将解析后的简历结构化数据拼接为自然语言文本，便于语义检索"""
    parts = []

    name = parsed_data.get("name", "")
    if name:
        parts.append(f"姓名：{name}")

    phone = parsed_data.get("phone", "")
    if phone:
        parts.append(f"手机号：{phone}")

    email = parsed_data.get("email", "")
    if email:
        parts.append(f"邮箱：{email}")

    employment_status = parsed_data.get("employment_status", "")
    if employment_status:
        status_map = {"employed": "在职", "unemployed": "离职", "fresh": "应届"}
        parts.append(f"在职状态：{status_map.get(employment_status, employment_status)}")

    expected_salary = parsed_data.get("expected_salary", "")
    if expected_salary:
        parts.append(f"期望薪资：{expected_salary}")

    skills = parsed_data.get("skills", [])
    if skills:
        parts.append(f"技能：{', '.join(skills)}")

    work_experience = parsed_data.get("work_experience", [])
    for exp in work_experience:
        exp_text = f"工作经历：{exp.get('company', '')} - {exp.get('position', '')}"
        start = exp.get("start_date", "")
        end = exp.get("end_date", "")
        if start:
            exp_text += f"（{start}至{end}）"
        desc = exp.get("description", "")
        if desc:
            exp_text += f"，{desc}"
        parts.append(exp_text)

    education = parsed_data.get("education", [])
    for edu in education:
        edu_text = f"教育背景：{edu.get('school', '')} - {edu.get('degree', '')} - {edu.get('major', '')}"
        start = edu.get("start_date", "")
        end = edu.get("end_date", "")
        if start:
            edu_text += f"（{start}至{end}）"
        parts.append(edu_text)

    return "\n".join(parts)


def _call_embedding_api(texts: list[str], api_key: str, base_url: str, model_name: str) -> tuple[list[list[float]], int]:
    """调用 Embedding API 生成向量，返回 (embeddings, total_tokens)"""
    import urllib.request

    url = f"{base_url}/embeddings"
    payload = json.dumps({
        "model": model_name,
        "input": texts,
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    resp = urllib.request.urlopen(req, timeout=300)
    data = json.loads(resp.read())

    # 按 index 排序确保顺序正确
    embeddings_data = sorted(data["data"], key=lambda x: x["index"])
    embeddings = [item["embedding"] for item in embeddings_data]
    total_tokens = data.get("usage", {}).get("total_tokens", 0)
    return embeddings, total_tokens


class VectorStoreService:
    """向量数据库服务，基于 NumPy 余弦相似度搜索"""

    _instance: Optional["VectorStoreService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_initialized"):
            return
        self._initialized = True
        self._store_path = Path(settings.CHROMA_PERSIST_DIR) / "vector_store.json"
        self._vectors: dict[str, dict] = {}  # {id: {embedding, content, metadata}}
        self._load()

    def _load(self):
        """从文件加载向量数据"""
        if self._store_path.exists():
            try:
                with open(self._store_path, "r", encoding="utf-8") as f:
                    self._vectors = json.load(f)
                logger.info(f"已加载 {len(self._vectors)} 条向量数据")
            except Exception as e:
                logger.error(f"加载向量数据失败: {e}")
                self._vectors = {}

    def _save(self):
        """保存向量数据到文件"""
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._store_path, "w", encoding="utf-8") as f:
            json.dump(self._vectors, f, ensure_ascii=False)

    def add_resume(self, resume_id: int, parsed_data: dict, metadata: dict = None, db_session=None) -> dict | bool:
        """将简历内容向量化并存储，返回 {"tokens_used": int, "config_name": str, "model_name": str} 或 False"""
        emb_config = _get_embedding_config(db_session)
        if not emb_config:
            logger.warning("Embedding 配置未找到（数据库和 .env 均无配置）")
            return False

        content = _build_resume_text(parsed_data)
        if not content.strip():
            return False

        meta = metadata or {}
        meta["name"] = parsed_data.get("name", "")
        meta["phone"] = parsed_data.get("phone", "")
        meta["email"] = parsed_data.get("email", "")

        # 调用 Embedding API
        try:
            embeddings, tokens_used = _call_embedding_api(
                [content], emb_config["api_key"], emb_config["base_url"], emb_config["model_name"]
            )
            embedding = embeddings[0]
        except Exception as e:
            logger.error(f"生成嵌入向量失败 简历 {resume_id}: {e}")
            return False

        with _db_lock:
            self._vectors[str(resume_id)] = {
                "embedding": embedding,
                "content": content,
                "metadata": meta,
            }
            self._save()
            logger.info(f"简历 {resume_id} 已向量化存储")
            return {
                "tokens_used": tokens_used,
                "config_name": emb_config.get("config_name", ""),
                "model_name": emb_config.get("model_name", ""),
            }

    def search(self, query_text: str, top_k: int = 10, db_session=None) -> list[dict]:
        """语义搜索，返回匹配的简历列表"""
        emb_config = _get_embedding_config(db_session)
        if not emb_config:
            return []

        if not self._vectors:
            return []

        # 生成查询向量
        try:
            query_embeddings, _ = _call_embedding_api(
                [query_text], emb_config["api_key"], emb_config["base_url"], emb_config["model_name"]
            )
            query_vec = np.array(query_embeddings[0])
        except Exception as e:
            logger.error(f"生成查询嵌入向量失败: {e}")
            return []

        # 计算余弦相似度
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return []

        scores = []
        with _db_lock:
            for rid, data in self._vectors.items():
                vec = np.array(data["embedding"])
                vec_norm = np.linalg.norm(vec)
                if vec_norm == 0:
                    continue
                similarity = float(np.dot(query_vec, vec) / (query_norm * vec_norm))
                scores.append({
                    "resume_id": int(rid),
                    "score": round(similarity, 4),
                    "content": data["content"],
                    "metadata": data["metadata"],
                })

        # 按相似度降序排序
        scores.sort(key=lambda x: x["score"], reverse=True)
        return scores[:top_k]

    def delete_resume(self, resume_id: int):
        """删除指定简历的向量"""
        with _db_lock:
            rid = str(resume_id)
            if rid in self._vectors:
                del self._vectors[rid]
                self._save()
                logger.info(f"简历 {resume_id} 向量已删除")

    def get_indexed_count(self) -> int:
        """获取已索引的简历数量"""
        return len(self._vectors)

    def build_index(self, db_session) -> dict:
        """全量构建索引，将所有已解析成功的简历向量化"""
        from app.models import Resume

        emb_config = _get_embedding_config(db_session)
        if not emb_config:
            return {"error": "Embedding 配置未找到（数据库和 .env 均无配置）"}

        resumes = db_session.query(Resume).filter(Resume.parse_status == "success").all()
        success_count = 0
        failed_count = 0

        for resume in resumes:
            if not resume.parsed_data:
                continue
            try:
                parsed_data = json.loads(resume.parsed_data)
                metadata = {
                    "name": parsed_data.get("name", ""),
                    "phone": parsed_data.get("phone", ""),
                    "email": parsed_data.get("email", ""),
                    "job_id": resume.job_id,
                }
                if self.add_resume(resume.id, parsed_data, metadata, db_session=db_session):
                    success_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.error(f"构建索引 - 简历 {resume.id} 失败: {e}")
                failed_count += 1

        return {
            "total": len(resumes),
            "success_count": success_count,
            "failed_count": failed_count,
        }


vector_store = VectorStoreService()
