@echo off
REM HR AI 一键启动脚本
REM 用法: start_all.bat
REM 依次启动 Redis、后端 API、Celery Worker、前端

echo ========================================
echo   HR AI 智能招聘平台 - 一键启动
echo ========================================
echo.

REM 检查 .env 是否存在
if not exist ".env" (
    echo [1/6] 检测到 .env 不存在，正在从模板创建...
    copy .env.example .env >nul
)

REM 检查密钥是否已配置
findstr /C:"^SECRET_KEY=" .env | findstr /C:"=" >nul
if %errorlevel% neq 0 (
    echo [2/6] .env 配置异常，重新生成...
    call "%~dp0generate_keys.bat"
) else (
    for /f "tokens=2 delims==" %%a in ('findstr /C:"^SECRET_KEY=" .env') do (
        if "%%a"=="" (
            echo [2/6] SECRET_KEY 为空，正在生成...
            call "%~dp0generate_keys.bat"
            goto :check_redis
        )
    )
)
:check_redis

echo [3/6] 检查 Redis 服务...
redis-cli ping >nul 2>&1
if %errorlevel% neq 0 (
    echo Redis 未运行，请先启动 Redis:
    echo   redis-server --port 6379
    echo.
    pause
    exit /b 1
)
echo Redis 运行正常
echo.

REM 启动后端 API
echo [4/6] 启动后端 API 服务...
start "HR AI Backend" cmd /k "cd /d %~dp0 && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul
echo 后端 API 已启动: http://localhost:8000
echo API 文档: http://localhost:8000/docs
echo.

REM 启动 Celery Worker
echo [5/6] 启动 Celery Worker...
start "HR AI Celery" cmd /k "cd /d %~dp0 && celery -A app.tasks worker --loglevel=info --pool=solo"
timeout /t 2 /nobreak >nul
echo Celery Worker 已启动
echo.

REM 启动前端
echo [6/6] 启动前端开发服务器...
cd /d %~dp0..\frontend
call npm run dev
echo.
