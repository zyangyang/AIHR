"""
Celery异步任务
"""
import json
import logging
import re
from pathlib import Path
from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models import Resume, ResumeScore, InterviewQuestion, TokenUsageLog, LLMConfig, Prompt
from app.core.security import decrypt_api_key

logger = logging.getLogger(__name__)


def extract_text_from_file(file_path: Path) -> str:
    """从 PDF/DOC/DOCX 文件中提取文本"""
    text = ""
    if file_path.suffix.lower() == ".pdf":
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
    elif file_path.suffix.lower() in [".doc", ".docx"]:
        from docx import Document
        doc = Document(file_path)
        text = "\n".join([p.text for p in doc.paragraphs])
    return text


def parse_text_with_llm(text: str, db_session=None, prompt_id: int = None, llm_config_id: int = None) -> dict:
    """
    调用 LLM 解析简历文本，返回结构化数据。
    如果传入 db_session，则从中获取提示词和模型配置；否则使用默认值。
    返回: {"parsed_data": dict, "tokens_used": int, "llm_config_id": int, "prompt_id": int}
    """
    db = db_session or SessionLocal()
    should_close = db_session is None
    try:
        # 获取解析提示词和LLM配置
        if prompt_id and llm_config_id:
            prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
            llm_config = db.query(LLMConfig).filter(LLMConfig.id == llm_config_id).first()
        else:
            prompt = db.query(Prompt).filter(Prompt.name == "简历解析提示词-默认", Prompt.type == "parse").first()
            llm_config = db.query(LLMConfig).filter(LLMConfig.is_active == True, LLMConfig.config_type == "chat").order_by(LLMConfig.id).first()

        if not prompt:
            raise ValueError("解析提示词未配置，请先在提示词管理中创建")
        if not llm_config:
            raise ValueError("没有可用的大模型配置，请先配置模型")

        # 调用 LLM
        from openai import OpenAI
        client = OpenAI(api_key=decrypt_api_key(llm_config.api_key_encrypted), base_url=llm_config.base_url)

        response = client.chat.completions.create(
            model=llm_config.model_name,
            messages=[
                {"role": "system", "content": prompt.content},
                {"role": "user", "content": text}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )

        result_text = response.choices[0].message.content
        tokens_used = response.usage.total_tokens

        try:
            parsed_data = json.loads(result_text)
        except json.JSONDecodeError:
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                parsed_data = json.loads(json_match.group())
            else:
                raise ValueError("AI返回格式解析失败")

        return {
            "parsed_data": parsed_data,
            "tokens_used": tokens_used,
            "llm_config_id": llm_config.id,
            "prompt_id": prompt.id,
            "price_per_million_tokens": llm_config.price_per_million_tokens,
        }
    finally:
        if should_close:
            db.close()


def _backfill_resume_fields(resume: Resume, parsed_data: dict):
    """从解析结果中提取字段回填到 Resume 记录"""
    field_map = {
        "name": "name",
        "phone": "phone",
        "email": "email",
        "employment_status": "employment_status",
        "expected_salary": "expected_salary",
    }
    for parsed_key, model_key in field_map.items():
        value = parsed_data.get(parsed_key)
        if value and not getattr(resume, model_key, None):
            setattr(resume, model_key, str(value))


@celery_app.task(bind=True, name="parse_resume")
def parse_resume_task(self, resume_id: int, prompt_id: int = None, llm_config_id: int = None):
    db = SessionLocal()
    try:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            return {"error": "简历不存在"}

        resume.parse_status = "parsing"
        db.commit()

        file_path = Path(resume.file_path)
        if not file_path.exists():
            resume.parse_status = "failed"
            db.commit()
            return {"error": "简历文件不存在"}

        # 1. 提取原始文本
        text = extract_text_from_file(file_path)
        if not text.strip():
            resume.parse_status = "failed"
            db.commit()
            return {"error": "无法从简历中提取文本内容"}

        # 2. 调用 LLM 解析
        result = parse_text_with_llm(text, db, prompt_id, llm_config_id)
        parsed_data = result["parsed_data"]
        tokens_used = result["tokens_used"]
        llm_config_id_used = result["llm_config_id"]
        prompt_id_used = result["prompt_id"]
        price_per_million_tokens = result["price_per_million_tokens"]

        # 3. 保存结果
        resume.parsed_data = json.dumps(parsed_data)
        resume.parse_status = "success"
        resume.parse_tokens_used = tokens_used
        resume.parse_llm_config_id = llm_config_id_used

        # 4. 回填 Resume 字段（仅当原字段为空时）
        _backfill_resume_fields(resume, parsed_data)
        db.commit()

        # 5. 自动向量化存储
        try:
            from app.services.vector_store import vector_store
            emb_result = vector_store.add_resume(resume_id, parsed_data, metadata={
                "name": parsed_data.get("name", ""),
                "phone": parsed_data.get("phone", ""),
                "email": parsed_data.get("email", ""),
                "job_id": resume.job_id,
            }, db_session=db)
            if isinstance(emb_result, dict) and emb_result.get("tokens_used"):
                resume.embedding_tokens_used = emb_result["tokens_used"]
                # 查找对应的 embedding LLM 配置
                emb_llm = db.query(LLMConfig).filter(
                    LLMConfig.config_type == "embedding", LLMConfig.is_active == True
                ).order_by(LLMConfig.id).first()
                if emb_llm:
                    resume.embedding_llm_config_id = emb_llm.id
                    emb_cost = (emb_result["tokens_used"] / 1000000) * (emb_llm.price_per_million_tokens or 0)
                    db.add(TokenUsageLog(llm_config_id=emb_llm.id, function_type="embedding", tokens_used=emb_result["tokens_used"], estimated_cost=emb_cost))
        except Exception as e:
            logger.warning(f"简历 {resume_id} 向量化存储失败（不影响解析）: {e}")

        # 6. 记录 Token 消耗
        cost = (tokens_used / 1000000) * (price_per_million_tokens or 0)
        db.add(TokenUsageLog(llm_config_id=llm_config_id_used, function_type="parse", tokens_used=tokens_used, estimated_cost=cost))
        prompt = db.query(Prompt).filter(Prompt.id == prompt_id_used).first()
        if prompt:
            prompt.usage_count += 1
        db.commit()

        return {"status": "success", "resume_id": resume_id, "tokens_used": tokens_used}
    except Exception as e:
        if resume:
            resume.parse_status = "failed"
            db.commit()
        error_msg = str(e) or f"{type(e).__name__}: API密钥可能已失效，请到大模型管理页面重新配置"
        return {"error": error_msg}
    finally:
        db.close()


@celery_app.task(bind=True, name="score_resume")
def score_resume_task(self, resume_id: int, prompt_id: int, llm_config_id: int):
    db = SessionLocal()
    try:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            return {"error": "简历不存在"}

        prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        llm_config = db.query(LLMConfig).filter(LLMConfig.id == llm_config_id).first()
        if not prompt or not llm_config:
            return {"error": "配置不存在"}

        from openai import OpenAI
        client = OpenAI(api_key=decrypt_api_key(llm_config.api_key_encrypted), base_url=llm_config.base_url)

        response = client.chat.completions.create(
            model=llm_config.model_name,
            messages=[
                {"role": "system", "content": prompt.content},
                {"role": "user", "content": f"职位：{resume.job.title}\n{resume.job.description}\n\n简历：{resume.parsed_data}"}
            ],
            temperature=0.7
        )

        result_text = response.choices[0].message.content
        tokens_used = response.usage.total_tokens

        try:
            score_data = json.loads(result_text)
        except json.JSONDecodeError:
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                score_data = json.loads(json_match.group())
            else:
                return {"error": "AI返回格式错误"}

        score = ResumeScore(
            resume_id=resume_id, job_id=resume.job_id, prompt_id=prompt_id, llm_config_id=llm_config_id,
            total_score=score_data.get("total_score", 0),
            responsibility_score=score_data.get("responsibility_score"),
            skill_score=score_data.get("skill_score"),
            experience_score=score_data.get("experience_score"),
            education_score=score_data.get("education_score"),
            soft_skill_score=score_data.get("soft_skill_score"),
            advantages=score_data.get("advantages"), disadvantages=score_data.get("disadvantages"),
            summary=score_data.get("summary"), raw_output=result_text, tokens_used=tokens_used
        )
        db.add(score)

        cost = (tokens_used / 1000000) * (llm_config.price_per_million_tokens or 0)
        db.add(TokenUsageLog(llm_config_id=llm_config_id, function_type="score", tokens_used=tokens_used, estimated_cost=cost))
        prompt.usage_count += 1
        db.commit()
        return {"status": "success", "score_id": score.id}
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(bind=True, name="generate_interview")
def generate_interview_task(self, resume_id: int, prompt_id: int, llm_config_id: int):
    db = SessionLocal()
    try:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            return {"error": "简历不存在"}

        prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        llm_config = db.query(LLMConfig).filter(LLMConfig.id == llm_config_id).first()
        if not prompt or not llm_config:
            return {"error": "配置不存在"}

        interview = db.query(InterviewQuestion).filter(InterviewQuestion.resume_id == resume_id).first()
        if not interview:
            interview = InterviewQuestion(resume_id=resume_id, job_id=resume.job_id, prompt_id=prompt_id, llm_config_id=llm_config_id, status="pending")
            db.add(interview)
            db.commit()
        else:
            interview.status = "pending"
            db.commit()

        from openai import OpenAI
        client = OpenAI(api_key=decrypt_api_key(llm_config.api_key_encrypted), base_url=llm_config.base_url)

        response = client.chat.completions.create(
            model=llm_config.model_name,
            messages=[
                {"role": "system", "content": prompt.content},
                {"role": "user", "content": f"职位：{resume.job.title}\n{resume.job.description}\n\n简历：{resume.parsed_data}"}
            ],
            temperature=0.7
        )

        result_text = response.choices[0].message.content
        tokens_used = response.usage.total_tokens

        try:
            questions_data = json.loads(result_text)
        except json.JSONDecodeError:
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                questions_data = json.loads(json_match.group())
            else:
                interview.status = "failed"
                db.commit()
                return {"error": "AI返回格式错误"}

        interview.status = "success"
        interview.questions = json.dumps(questions_data)
        interview.raw_output = result_text
        interview.tokens_used = tokens_used
        db.commit()

        cost = (tokens_used / 1000000) * (llm_config.price_per_million_tokens or 0)
        db.add(TokenUsageLog(llm_config_id=llm_config_id, function_type="interview", tokens_used=tokens_used, estimated_cost=cost))
        prompt.usage_count += 1
        db.commit()
        return {"status": "success", "interview_id": interview.id}
    except Exception as e:
        if interview:
            interview.status = "failed"
            db.commit()
        return {"error": str(e)}
    finally:
        db.close()
