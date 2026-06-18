"""
数据库模型
"""
import json
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(100), nullable=False)
    category = Column(String(50))
    location = Column(String(100), nullable=False)
    salary_range = Column(String(50))
    description = Column(Text, nullable=False)
    hard_requirements = Column(Text)
    status = Column(String(20), nullable=False, default="draft")
    apply_token = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    resumes = relationship("Resume", back_populates="job", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "location": self.location,
            "salary_range": self.salary_range,
            "description": self.description,
            "hard_requirements": json.loads(self.hard_requirements) if self.hard_requirements else None,
            "status": self.status,
            "apply_token": self.apply_token,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def to_list_dict(self, resume_count=0):
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "location": self.location,
            "salary_range": self.salary_range,
            "status": self.status,
            "apply_token": self.apply_token,
            "resume_count": resume_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    name = Column(String(50), nullable=True, default="")
    phone = Column(String(20), nullable=True, default="")
    email = Column(String(100), nullable=True, default="")
    employment_status = Column(String(20), nullable=True, default="")
    expected_salary = Column(String(50))
    additional_message = Column(Text)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(200), nullable=False)
    file_size = Column(Integer, nullable=False)
    parse_status = Column(String(20), nullable=False, default="pending")
    parsed_data = Column(Text)
    parse_tokens_used = Column(Integer)
    parse_llm_config_id = Column(Integer, ForeignKey("llm_configs.id"))
    embedding_tokens_used = Column(Integer)
    embedding_llm_config_id = Column(Integer, ForeignKey("llm_configs.id"))
    status = Column(String(20), nullable=False, default="new")
    reject_reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    job = relationship("Job", back_populates="resumes")
    scores = relationship("ResumeScore", back_populates="resume", cascade="all, delete-orphan")
    interview_question = relationship("InterviewQuestion", back_populates="resume", uselist=False)
    parse_llm_config = relationship("LLMConfig", foreign_keys=[parse_llm_config_id])
    embedding_llm_config = relationship("LLMConfig", foreign_keys=[embedding_llm_config_id])

    def to_dict(self, include_details=True):
        result = {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "employment_status": self.employment_status,
            "expected_salary": self.expected_salary,
            "additional_message": self.additional_message,
            "job_id": self.job_id,
            "job_title": self.job.title if self.job else None,
            "file_path": self.file_path,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "parse_status": self.parse_status,
            "parsed_data": json.loads(self.parsed_data) if self.parsed_data else None,
            "parse_tokens_used": self.parse_tokens_used,
            "parse_model_name": self.parse_llm_config.model_name if self.parse_llm_config else None,
            "parse_estimated_cost": (self.parse_tokens_used / 1000000 * self.parse_llm_config.price_per_million_tokens) if (self.parse_tokens_used and self.parse_llm_config and self.parse_llm_config.price_per_million_tokens) else None,
            "embedding_tokens_used": self.embedding_tokens_used,
            "embedding_model_name": self.embedding_llm_config.model_name if self.embedding_llm_config else None,
            "embedding_estimated_cost": (self.embedding_tokens_used / 1000000 * self.embedding_llm_config.price_per_million_tokens) if (self.embedding_tokens_used and self.embedding_llm_config and self.embedding_llm_config.price_per_million_tokens) else None,
            "status": self.status,
            "reject_reason": self.reject_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if include_details:
            result["scores"] = [s.to_dict() for s in self.scores]
            result["interview_question"] = self.interview_question.to_dict() if self.interview_question else None
        return result

    def to_list_dict(self):
        latest_score = self.scores[-1] if self.scores else None
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "job_id": self.job_id,
            "job_title": self.job.title if self.job else None,
            "status": self.status,
            "parse_status": self.parse_status,
            "score_status": "success" if latest_score else "pending",
            "interview_status": self.interview_question.status if self.interview_question else "pending",
            "score": latest_score.total_score if latest_score else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ResumeScore(Base):
    __tablename__ = "resume_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=False)
    llm_config_id = Column(Integer, ForeignKey("llm_configs.id"), nullable=False)
    total_score = Column(Integer, nullable=False)
    responsibility_score = Column(Integer)
    skill_score = Column(Integer)
    experience_score = Column(Integer)
    education_score = Column(Integer)
    soft_skill_score = Column(Integer)
    advantages = Column(Text)
    disadvantages = Column(Text)
    summary = Column(Text)
    raw_output = Column(Text)
    tokens_used = Column(Integer)
    scored_at = Column(DateTime, server_default=func.now(), nullable=False)

    resume = relationship("Resume", back_populates="scores")
    prompt = relationship("Prompt")
    llm_config = relationship("LLMConfig")

    def to_dict(self):
        return {
            "id": self.id,
            "total_score": self.total_score,
            "responsibility_score": self.responsibility_score,
            "skill_score": self.skill_score,
            "experience_score": self.experience_score,
            "education_score": self.education_score,
            "soft_skill_score": self.soft_skill_score,
            "advantages": self.advantages,
            "disadvantages": self.disadvantages,
            "summary": self.summary,
            "prompt_name": self.prompt.name if self.prompt else None,
            "model_name": self.llm_config.model_name if self.llm_config else None,
            "tokens_used": self.tokens_used,
            "estimated_cost": (self.tokens_used / 1000000 * self.llm_config.price_per_million_tokens) if (self.tokens_used and self.llm_config and self.llm_config.price_per_million_tokens) else None,
            "scored_at": self.scored_at.isoformat() if self.scored_at else None
        }


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=False)
    llm_config_id = Column(Integer, ForeignKey("llm_configs.id"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    questions = Column(Text)
    raw_output = Column(Text)
    tokens_used = Column(Integer)
    generated_at = Column(DateTime, server_default=func.now(), nullable=False)

    resume = relationship("Resume", back_populates="interview_question")
    prompt = relationship("Prompt")
    llm_config = relationship("LLMConfig")

    def to_dict(self):
        return {
            "id": self.id,
            "status": self.status,
            "questions": json.loads(self.questions) if self.questions else None,
            "prompt_name": self.prompt.name if self.prompt else None,
            "model_name": self.llm_config.model_name if self.llm_config else None,
            "tokens_used": self.tokens_used,
            "estimated_cost": (self.tokens_used / 1000000 * self.llm_config.price_per_million_tokens) if (self.tokens_used and self.llm_config and self.llm_config.price_per_million_tokens) else None,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None
        }


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    type = Column(String(30), nullable=False)
    content = Column(Text, nullable=False)
    is_system_default = Column(Boolean, nullable=False, default=False)
    current_version = Column(Integer, nullable=False, default=1)
    usage_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    versions = relationship("PromptVersion", back_populates="prompt", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "content": self.content,
            "is_system_default": self.is_system_default,
            "current_version": self.current_version,
            "usage_count": self.usage_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def to_list_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "is_system_default": self.is_system_default,
            "current_version": self.current_version,
            "usage_count": self.usage_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=False)
    version = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    prompt = relationship("Prompt", back_populates="versions")

    def to_dict(self):
        return {
            "version": self.version,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class LLMConfig(Base):
    __tablename__ = "llm_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False)
    model_name = Column(String(100), nullable=False)
    api_key_encrypted = Column(Text, nullable=False)
    base_url = Column(String(200), nullable=False)
    price_per_million_tokens = Column(Float)
    is_active = Column(Boolean, nullable=False, default=True)
    config_type = Column(String(20), nullable=False, default="chat")  # chat | embedding
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "model_name": self.model_name,
            "base_url": self.base_url,
            "price_per_million_tokens": self.price_per_million_tokens,
            "is_active": self.is_active,
            "config_type": self.config_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class TokenUsageLog(Base):
    __tablename__ = "token_usage_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    llm_config_id = Column(Integer, ForeignKey("llm_configs.id"), nullable=False)
    function_type = Column(String(30), nullable=False)
    tokens_used = Column(Integer, nullable=False)
    estimated_cost = Column(Float)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    llm_config = relationship("LLMConfig")

    def to_dict(self):
        return {
            "id": self.id,
            "llm_config_id": self.llm_config_id,
            "function_type": self.function_type,
            "tokens_used": self.tokens_used,
            "estimated_cost": self.estimated_cost,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
