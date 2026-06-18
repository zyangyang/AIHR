"""
主应用入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.models import Base
from app.api import api_router

Base.metadata.create_all(bind=engine)

# 迁移：为 resumes 表添加 parse_tokens_used 和 parse_llm_config_id 字段
with engine.connect() as conn:
    result = conn.execute(text("PRAGMA table_info(resumes)"))
    columns = [row[1] for row in result.fetchall()]
    if 'parse_tokens_used' not in columns:
        conn.execute(text("ALTER TABLE resumes ADD COLUMN parse_tokens_used INTEGER"))
    if 'parse_llm_config_id' not in columns:
        conn.execute(text("ALTER TABLE resumes ADD COLUMN parse_llm_config_id INTEGER REFERENCES llm_configs(id)"))
    conn.commit()

# 迁移：为 llm_configs 表添加 config_type 字段
with engine.connect() as conn:
    result = conn.execute(text("PRAGMA table_info(llm_configs)"))
    columns = [row[1] for row in result.fetchall()]
    if 'config_type' not in columns:
        conn.execute(text("ALTER TABLE llm_configs ADD COLUMN config_type VARCHAR(20) DEFAULT 'chat' NOT NULL"))
        conn.commit()

# 迁移：为 resumes 表添加 embedding_tokens_used 和 embedding_llm_config_id 字段
with engine.connect() as conn:
    result = conn.execute(text("PRAGMA table_info(resumes)"))
    columns = [row[1] for row in result.fetchall()]
    if 'embedding_tokens_used' not in columns:
        conn.execute(text("ALTER TABLE resumes ADD COLUMN embedding_tokens_used INTEGER"))
    if 'embedding_llm_config_id' not in columns:
        conn.execute(text("ALTER TABLE resumes ADD COLUMN embedding_llm_config_id INTEGER REFERENCES llm_configs(id)"))
    conn.commit()

Path("uploads/resumes").mkdir(parents=True, exist_ok=True)
Path("uploads/temp").mkdir(parents=True, exist_ok=True)
Path("downloads").mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION, docs_url="/docs", redoc_url="/redoc")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    from app.db.session import SessionLocal
    from app.models import User, Prompt, PromptVersion
    from app.core.security import get_password_hash

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            # Admin user must be created manually with a secure password.
            # To create one, run: python -c "from app.core.security import get_password_hash; print(get_password_hash('YOUR_STRONG_PASSWORD'))"
            pass

        score_prompt = db.query(Prompt).filter(Prompt.name == "简历打分提示词-默认").first()
        if not score_prompt:
            score_content = """你是一位经验丰富的招聘专家，现在需要根据以下简历内容，分析候选人与职位的匹配程度，并输出匹配分析结果。请根据以下维度进行评分：
- 核心职责匹配度（0-100分）
- 硬技能匹配度（0-100分）
- 经验年限与质量（0-100分）
- 教育背景与证书（0-100分）
- 软技能与文化契合度（0-100分）

请根据以上五个维度分别打分，并给出综合分数（0-100分）。综合分数不是简单的平均，而是根据职位需求加权得出。

同时请输出：
1. 优势总结（候选人最突出的3个优势）
2. 差距分析（候选人与职位要求的主要差距）
3. 一句话总结（50字以内）

请严格按照以下JSON格式输出，不要输出其他任何内容：
{
  "responsibility_score": 85,
  "skill_score": 90,
  "experience_score": 80,
  "education_score": 95,
  "soft_skill_score": 75,
  "total_score": 85,
  "advantages": "优势总结...",
  "disadvantages": "差距分析...",
  "summary": "一句话总结..."
}"""
            score_prompt = Prompt(
                name="简历打分提示词-默认", type="score", content=score_content,
                is_system_default=True, current_version=1
            )
            db.add(score_prompt)
            db.flush()
            db.add(PromptVersion(prompt_id=score_prompt.id, version=1, content=score_content))

        interview_prompt = db.query(Prompt).filter(Prompt.name == "面试题生成提示词-默认").first()
        if not interview_prompt:
            interview_content = """你是一位资深技术面试官，现在需要根据以下简历内容，为候选人设计一套面试题。

请根据以下维度设计面试题：
1. 工作经历验证（验证候选人简历中提到的项目经验是否真实）
2. 技术深度考察（考察候选人核心技术的掌握程度）
3. 问题解决能力（考察候选人的问题分析和解决能力）
4. 软技能与沟通能力（考察候选人的沟通表达和团队协作能力）

每个维度设计2-3道面试题，每道题需要包含：
- 问题描述
- 考察意图
- 评估要点（2-3个）

请严格按照以下JSON格式输出，不要输出其他任何内容：
{
  "module_1": [
    {
      "question": "问题描述",
      "intent": "考察意图",
      "evaluation_points": ["评估要点1", "评估要点2"]
    }
  ],
  "module_2": [...],
  "module_3": [...],
  "module_4": [...]
}"""
            interview_prompt = Prompt(
                name="面试题生成提示词-默认", type="interview", content=interview_content,
                is_system_default=True, current_version=1
            )
            db.add(interview_prompt)
            db.flush()
            db.add(PromptVersion(prompt_id=interview_prompt.id, version=1, content=interview_content))

        parse_prompt = db.query(Prompt).filter(Prompt.name == "简历解析提示词-默认").first()
        if not parse_prompt:
            parse_content = """你是一位专业的简历解析助手。请将以下简历内容提取为结构化的JSON数据。

请提取以下信息：
1. 基本信息：姓名(name)、手机号(phone)、邮箱(email)、在职状态(employment_status)、期望薪资(expected_salary)
2. 工作经历(work_experience)：每段经历包含公司(company)、职位(position)、开始时间(start_date)、结束时间(end_date)、描述(description)
3. 教育背景(education)：每段教育经历包含学校(school)、学历(degree)、专业(major)、开始时间(start_date)、结束时间(end_date)
4. 技能清单(skills)：字符串数组

在职状态(employment_status)请从以下选项中选择最匹配的：employed（在职）、unemployed（离职）、fresh（应届）
期望薪资(expected_salary)请提取为字符串格式，如"15K"、"20K-25K"等

请严格按照以下JSON格式输出，不要输出其他任何内容。如果某些信息无法提取，请用空字符串或空数组表示：
{
  "name": "候选人姓名",
  "phone": "手机号码",
  "email": "邮箱地址",
  "employment_status": "employed/unemployed/fresh",
  "expected_salary": "期望薪资",
  "work_experience": [
    {
      "company": "公司名称",
      "position": "职位",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM",
      "description": "工作描述"
    }
  ],
  "education": [
    {
      "school": "学校名称",
      "degree": "学历",
      "major": "专业",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM"
    }
  ],
  "skills": ["技能1", "技能2"]
}"""
            parse_prompt = Prompt(
                name="简历解析提示词-默认", type="parse", content=parse_content,
                is_system_default=True, current_version=1
            )
            db.add(parse_prompt)
            db.flush()
            db.add(PromptVersion(prompt_id=parse_prompt.id, version=1, content=parse_content))

        db.commit()
    finally:
        db.close()
