"""
匹配处理API
"""
import os
import re
import threading
import uuid
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import ApiResponse
from app.core.security import get_current_user
from app.core.celery_app import is_celery_available
from app.models import Resume, Prompt, LLMConfig, ResumeScore

router = APIRouter(prefix="/matching", tags=["匹配处理"])


def _get_celery_task(task_name: str):
    """获取 Celery 任务，如果 Celery/Redis 不可用则返回 None"""
    if not is_celery_available():
        return None
    try:
        from app.tasks import parse_resume_task, score_resume_task
        return {"parse_resume": parse_resume_task, "score_resume": score_resume_task}.get(task_name)
    except Exception:
        return None


@router.post("/{resume_id}/parse", response_model=ApiResponse)
def trigger_parse(
    resume_id: int,
    request: dict = Body(default={}),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    if resume.parse_status == "parsing":
        raise HTTPException(status_code=400, detail="简历正在解析中")

    task = _get_celery_task("parse_resume")
    prompt_id = request.get("prompt_id")
    llm_config_id = request.get("llm_config_id")

    if task:
        try:
            resume.parse_status = "parsing"
            db.commit()
            celery_task = task.delay(resume_id, prompt_id, llm_config_id)
            return ApiResponse(message="识别任务已提交", data={"task_id": celery_task.id})
        except Exception:
            pass

    # 同步回退：在后台线程执行，避免阻塞 HTTP 响应
    import threading
    def _run_parse_in_background():
        from app.tasks import parse_resume_task
        result = parse_resume_task.run(resume_id, prompt_id, llm_config_id)
        if "error" in result:
            print(f"解析失败: {result['error']}")
        else:
            print(f"解析完成: {result}")

    resume.parse_status = "parsing"
    db.commit()
    threading.Thread(target=_run_parse_in_background, daemon=True).start()
    return ApiResponse(message="识别任务已提交", data={"task_id": str(uuid.uuid4())})


@router.get("/{resume_id}/parse/status", response_model=ApiResponse)
def get_parse_status(resume_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    import json
    return ApiResponse(data={"status": resume.parse_status, "parsed_data": json.loads(resume.parsed_data) if resume.parsed_data else None})


@router.post("/{resume_id}/score", response_model=ApiResponse)
def trigger_score(
    resume_id: int, request: dict = Body(default={}), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    if resume.parse_status != "success":
        raise HTTPException(status_code=400, detail="简历尚未解析完成")

    prompt_id = request.get("prompt_id")
    llm_config_id = request.get("llm_config_id")
    if not prompt_id:
        prompt = db.query(Prompt).filter(Prompt.name == "简历打分提示词-默认", Prompt.type == "score").first()
        if not prompt:
            raise HTTPException(status_code=400, detail="请先在提示词管理中创建打分提示词")
        prompt_id = prompt.id
    if not llm_config_id:
        llm_config = db.query(LLMConfig).filter(LLMConfig.is_active == True, LLMConfig.config_type == "chat").order_by(LLMConfig.id).first()
        if not llm_config:
            raise HTTPException(status_code=400, detail="请先在模型管理中配置大模型")
        llm_config_id = llm_config.id

    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    llm_config = db.query(LLMConfig).filter(LLMConfig.id == llm_config_id).first()
    if not llm_config:
        raise HTTPException(status_code=404, detail="大模型配置不存在")

    task = _get_celery_task("score_resume")
    if task:
        try:
            celery_task = task.delay(resume_id, prompt_id, llm_config_id)
            return ApiResponse(message="打分任务已提交", data={"task_id": celery_task.id})
        except Exception:
            pass

    # 同步回退：后台线程执行
    def _run_score_in_background():
        from app.tasks import score_resume_task
        result = score_resume_task.run(resume_id, prompt_id, llm_config_id)
        if "error" in result:
            print(f"打分失败: {result['error']}")
        else:
            print(f"打分完成: {result}")

    threading.Thread(target=_run_score_in_background, daemon=True).start()
    return ApiResponse(message="打分任务已提交", data={"task_id": str(uuid.uuid4())})


@router.get("/{resume_id}/score/status", response_model=ApiResponse)
def get_score_status(resume_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    latest_score = resume.scores[-1] if resume.scores else None
    if latest_score:
        return ApiResponse(data={"status": "success", "score": latest_score.to_dict()})
    return ApiResponse(data={"status": "pending"})


@router.post("/{resume_id}/rescore", response_model=ApiResponse)
def rescore_resume(
    resume_id: int, request: dict = Body(default={}), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    prompt_id = request.get("prompt_id")
    llm_config_id = request.get("llm_config_id")
    if not prompt_id:
        prompt = db.query(Prompt).filter(Prompt.name == "简历打分提示词-默认", Prompt.type == "score").first()
        if not prompt:
            raise HTTPException(status_code=400, detail="请先在提示词管理中创建打分提示词")
        prompt_id = prompt.id
    if not llm_config_id:
        llm_config = db.query(LLMConfig).filter(LLMConfig.is_active == True, LLMConfig.config_type == "chat").order_by(LLMConfig.id).first()
        if not llm_config:
            raise HTTPException(status_code=400, detail="请先在模型管理中配置大模型")
        llm_config_id = llm_config.id

    task = _get_celery_task("score_resume")
    if task:
        try:
            celery_task = task.delay(resume_id, prompt_id, llm_config_id)
            return ApiResponse(message="重新打分任务已提交", data={"task_id": celery_task.id})
        except Exception:
            pass

    def _run_rescore_in_background():
        from app.tasks import score_resume_task
        result = score_resume_task.run(resume_id, prompt_id, llm_config_id)
        if "error" in result:
            print(f"重新打分失败: {result['error']}")
        else:
            print(f"重新打分完成: {result}")

    resume.scores = []  # trigger parsing status reset
    threading.Thread(target=_run_rescore_in_background, daemon=True).start()
    return ApiResponse(message="重新打分任务已提交", data={"task_id": str(uuid.uuid4())})


@router.get("/{resume_id}/download/score-pdf")
def download_score_pdf(resume_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    import traceback
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import platform

    from sqlalchemy.orm import joinedload
    try:
        resume = db.query(Resume).options(joinedload(Resume.job)).filter(Resume.id == resume_id).first()
        if not resume:
            raise HTTPException(status_code=404, detail="简历不存在")
        latest_score = resume.scores[-1] if resume.scores else None
        if not latest_score:
            raise HTTPException(status_code=400, detail="初筛报告尚未生成")

        # 注册中文字体
        font_path = None
        if platform.system() == "Windows":
            windir = os.environ.get("WINDIR", "C:\\Windows")
            candidates = [
                Path(windir) / "Fonts" / "simhei.ttf",
                Path(windir) / "Fonts" / "simsun.ttc",
                Path(windir) / "Fonts" / "msyh.ttc",
            ]
            for p in candidates:
                if p.exists():
                    font_path = str(p)
                    break
        elif platform.system() == "Darwin":
            mac_candidates = [
                "/System/Library/Fonts/PingFang.ttc",
                "/System/Library/Fonts/STHeiti Light.ttc",
                "/Library/Fonts/Arial Unicode.ttf",
            ]
            for p in mac_candidates:
                if Path(p).exists():
                    font_path = str(p)
                    break
        else:
            linux_candidates = [
                "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
                "/usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc",
                "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
            ]
            for p in linux_candidates:
                if Path(p).exists():
                    font_path = str(p)
                    break

        if not font_path:
            raise HTTPException(status_code=500, detail="系统未安装中文字体，无法生成PDF")

        font_name = 'ChineseFont'
        bold_font_name = 'ChineseFontBold'
        if font_path.lower().endswith('.ttc'):
            pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=0))
            try:
                pdfmetrics.registerFont(TTFont(bold_font_name, font_path, subfontIndex=0))
                registerFontFamily(font_name, normal=font_name, bold=bold_font_name, italic=font_name, boldItalic=bold_font_name)
            except:
                bold_font_name = font_name
        else:
            pdfmetrics.registerFont(TTFont(font_name, font_path))
            try:
                pdfmetrics.registerFont(TTFont(bold_font_name, font_path))
                registerFontFamily(font_name, normal=font_name, bold=bold_font_name, italic=font_name, boldItalic=bold_font_name)
            except:
                bold_font_name = font_name

        # 文件命名规则：应聘岗位-简历姓名-手机号-初筛报告
        job_title = resume.job.title if resume.job else '未知岗位'
        safe_job_title = re.sub(r'[\\/:*?"<>|]', '-', job_title).strip('-')
        base_name = f"{safe_job_title}-{resume.name}-{resume.phone}-初筛报告"
        filename = f"{base_name}.pdf"
        # 使用项目根目录下的绝对路径，避免因工作目录变化导致路径错误
        output_dir = Path(__file__).resolve().parent.parent.parent / "downloads"
        output_dir.mkdir(exist_ok=True)
        output_path = output_dir / filename

        doc = SimpleDocTemplate(str(output_path), pagesize=A4)

        doc_title_style = ParagraphStyle(
            name='DocTitle',
            fontName=bold_font_name,
            fontSize=18,
            spaceAfter=12,
            alignment=1,
            leading=26,
        )
        section_style = ParagraphStyle(
            name='SectionTitle',
            fontName=bold_font_name,
            fontSize=14,
            spaceBefore=12,
            spaceAfter=6,
            leading=20,
        )
        normal_style = ParagraphStyle(
            name='ChineseNormal',
            fontName=font_name,
            fontSize=11,
            spaceAfter=4,
            leading=16,
        )
        small_style = ParagraphStyle(
            name='ChineseSmall',
            fontName=font_name,
            fontSize=10,
            spaceAfter=3,
            leading=14,
        )

        story = []

        # 文档标题
        story.append(Paragraph(f"<b>{base_name}</b>", doc_title_style))
        story.append(Spacer(1, 8*mm))

        # 一、候选人信息
        story.append(Paragraph("一、候选人信息", section_style))
        story.append(Spacer(1, 2*mm))
        employment_map = {'employed': '在职', 'unemployed': '离职', 'fresh': '应届'}
        employment = employment_map.get(resume.employment_status, resume.employment_status or '-')
        expected_salary = resume.expected_salary or '-'
        story.append(Paragraph(f"<b>姓名：</b>{resume.name or '-'}  <b>应聘职位：</b>{job_title}  <b>手机号：</b>{resume.phone or '-'}", normal_style))
        story.append(Paragraph(f"<b>邮箱：</b>{resume.email or '-'}  <b>在职状态：</b>{employment}  <b>期望薪资：</b>{expected_salary}", normal_style))
        story.append(Spacer(1, 6*mm))

        # 二、评分概览
        story.append(Paragraph("二、评分概览", section_style))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(f"<b>综合评分：</b>{latest_score.total_score}/100", normal_style))
        story.append(Paragraph(f"<b>责任心：</b>{latest_score.responsibility_score}/100  <b>技能匹配度：</b>{latest_score.skill_score}/100  <b>经验匹配度：</b>{latest_score.experience_score}/100", normal_style))
        story.append(Paragraph(f"<b>教育背景：</b>{latest_score.education_score}/100  <b>软技能：</b>{latest_score.soft_skill_score}/100", normal_style))
        story.append(Spacer(1, 6*mm))

        # 三、关键优势
        story.append(Paragraph("三、关键优势", section_style))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(latest_score.advantages or '无', normal_style))
        story.append(Spacer(1, 6*mm))

        # 四、关键差距
        story.append(Paragraph("四、关键差距", section_style))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(latest_score.disadvantages or '无', normal_style))
        story.append(Spacer(1, 6*mm))

        # 五、总结
        story.append(Paragraph("五、总结", section_style))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(latest_score.summary or '无', normal_style))
        story.append(Spacer(1, 8*mm))

        # 六、生成信息
        story.append(Paragraph("六、生成信息", section_style))
        story.append(Spacer(1, 2*mm))
        model_name = latest_score.llm_config.name if latest_score.llm_config else '-'
        prompt_name = latest_score.prompt.name if latest_score.prompt else '-'
        story.append(Paragraph(f"<b>使用模型：</b>{model_name}", small_style))
        story.append(Paragraph(f"<b>使用提示词：</b>{prompt_name}", small_style))
        story.append(Paragraph(f"<b>Token消耗：</b>{latest_score.tokens_used or '-'}", small_style))
        story.append(Paragraph(f"<b>生成时间：</b>{latest_score.scored_at.strftime('%Y-%m-%d %H:%M') if latest_score.scored_at else '-'}", small_style))

        doc.build(story)
        return FileResponse(path=str(output_path), filename=filename, media_type="application/pdf")

    except HTTPException:
        raise
    except Exception as e:
        print(f"下载初筛报告失败: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"生成PDF失败: {str(e)}")
