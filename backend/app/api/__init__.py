from fastapi import APIRouter
from app.api import auth, jobs, apply, resumes, matching, interviews, prompts, llm_configs, dashboard, ai_search

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(apply.router)
api_router.include_router(resumes.router)
api_router.include_router(matching.router)
api_router.include_router(interviews.router)
api_router.include_router(prompts.router)
api_router.include_router(llm_configs.router)
api_router.include_router(dashboard.router)
api_router.include_router(ai_search.router)
