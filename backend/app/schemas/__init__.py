"""
Pydantic数据验证模式
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class JobCreate(BaseModel):
    title: str
    category: Optional[str] = None
    location: str
    salary_range: Optional[str] = None
    description: str
    hard_requirements: Optional[Dict[str, Any]] = None
    status: Optional[str] = "draft"


class JobUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    description: Optional[str] = None
    hard_requirements: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class JobStatusUpdate(BaseModel):
    status: str


class JobResponse(BaseModel):
    id: int
    title: str
    category: Optional[str]
    location: str
    salary_range: Optional[str]
    description: str
    hard_requirements: Optional[Dict[str, Any]]
    status: str
    apply_token: str
    created_at: datetime
    updated_at: datetime


class JobListItem(BaseModel):
    id: int
    title: str
    category: Optional[str]
    location: str
    salary_range: Optional[str]
    status: str
    apply_token: str
    resume_count: int
    created_at: datetime
    updated_at: datetime


class JobListResponse(BaseModel):
    items: List[JobListItem]
    total: int
    page: int
    page_size: int


class ApplyJobInfo(BaseModel):
    job_id: int
    title: str
    location: str
    salary_range: Optional[str]
    description: str
    status: str


class CaptchaResponse(BaseModel):
    captcha_id: str
    captcha_image: str


class ResumeListItem(BaseModel):
    id: int
    name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    job_id: int
    job_title: str
    status: str
    parse_status: str
    score_status: str
    interview_status: str
    score: Optional[int]
    created_at: datetime


class ResumeListResponse(BaseModel):
    items: List[ResumeListItem]
    total: int
    page: int
    page_size: int


class ResumeScoreItem(BaseModel):
    id: int
    total_score: int
    responsibility_score: Optional[int]
    skill_score: Optional[int]
    experience_score: Optional[int]
    education_score: Optional[int]
    soft_skill_score: Optional[int]
    advantages: Optional[str]
    disadvantages: Optional[str]
    summary: Optional[str]
    prompt_name: Optional[str]
    model_name: Optional[str]
    tokens_used: Optional[int]
    scored_at: datetime


class InterviewQuestionItem(BaseModel):
    id: int
    status: str
    questions: Optional[Dict[str, Any]]
    prompt_name: Optional[str]
    model_name: Optional[str]
    tokens_used: Optional[int]
    generated_at: datetime


class ResumeDetail(BaseModel):
    id: int
    name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    employment_status: Optional[str] = ""
    expected_salary: Optional[str]
    additional_message: Optional[str]
    job_id: int
    job_title: str
    file_path: str
    file_name: str
    file_size: int
    parse_status: str
    parsed_data: Optional[Dict[str, Any]]
    status: str
    reject_reason: Optional[str]
    scores: List[ResumeScoreItem]
    interview_question: Optional[InterviewQuestionItem]
    created_at: datetime
    updated_at: datetime


class ResumeStatusUpdate(BaseModel):
    status: str
    reject_reason: Optional[str] = None


class ScoreRequest(BaseModel):
    prompt_id: int
    llm_config_id: int


class TaskResponse(BaseModel):
    task_id: str


class ParseStatusResponse(BaseModel):
    status: str
    parsed_data: Optional[Dict[str, Any]] = None


class ScoreStatusResponse(BaseModel):
    status: str
    score: Optional[ResumeScoreItem] = None


class InterviewGenerateRequest(BaseModel):
    prompt_id: int
    llm_config_id: int


class InterviewStatusResponse(BaseModel):
    status: str
    questions: Optional[Dict[str, Any]] = None


class PromptListItem(BaseModel):
    id: int
    name: str
    type: str
    is_system_default: bool
    current_version: int
    usage_count: int
    created_at: datetime
    updated_at: datetime


class PromptVersionItem(BaseModel):
    version: int
    content: str
    created_at: datetime


class PromptDetail(BaseModel):
    id: int
    name: str
    type: str
    content: str
    is_system_default: bool
    current_version: int
    usage_count: int
    versions: List[PromptVersionItem]
    created_at: datetime
    updated_at: datetime


class PromptCreate(BaseModel):
    name: str
    type: str
    content: str


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None


class LLMConfigItem(BaseModel):
    id: int
    name: str
    provider: str
    model_name: str
    base_url: str
    price_per_million_tokens: Optional[float]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LLMConfigCreate(BaseModel):
    name: str
    provider: str
    model_name: str
    api_key: str
    base_url: str
    price_per_million_tokens: Optional[float] = None
    is_active: bool = True


class TokenUsageItem(BaseModel):
    function_type: str
    tokens: int
    cost: float


class TokenUsageByDay(BaseModel):
    date: str
    tokens: int
    cost: float


class TokenUsageResponse(BaseModel):
    total_tokens: int
    total_cost: float
    by_function: List[TokenUsageItem]
    by_day: List[TokenUsageByDay]


class ApiResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None
