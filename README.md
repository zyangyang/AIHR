# HR 智能招聘平台

基于 AI 的智能招聘管理系统，支持简历解析、智能初筛、面试题生成、AI 语义搜索等功能。支持云端 API 和本地 Ollama 两种 AI 接入方式。

## 技术栈

### 后端
- **框架**：FastAPI + Uvicorn
- **数据库**：SQLite + SQLAlchemy
- **异步任务**：Celery + Redis
- **AI 集成**：OpenAI 兼容 API（支持硅基流动、OpenAI、本地 Ollama 等）
- **向量搜索**：NumPy 余弦相似度 + JSON 文件持久化（轻量级自实现方案）
- **文件处理**：pdfplumber、python-docx、reportlab

### 前端
- **框架**：React 18 + TypeScript
- **UI 组件**：Ant Design 5
- **路由**：React Router 6
- **状态管理**：Zustand
- **HTTP 客户端**：Axios
- **构建工具**：Vite

## 功能模块

| 模块 | 说明 |
|------|------|
| 数据概览 | 招聘数据统计看板 |
| 职位管理 | 职位发布、编辑、状态管理 |
| 简历管理 | 简历导入（PDF/DOCX）、AI 解析、状态流转 |
| AI 搜索简历 | 基于 RAG 的语义搜索，自然语言查找候选人 |
| 匹配中心 | 简历初筛评分、面试题生成 |
| 面试题管理 | 面试题查看、PDF/DOCX 导出 |
| 提示词管理 | Prompt 模板版本管理 |
| 大模型管理 | LLM 配置（对话模型 + 嵌入模型）、API Key 加密存储、Token 用量统计 |

## AI 搜索简历（RAG）

独立的语义搜索功能，通过 RAG（检索增强生成）方式实现简历智能检索。

### 技术方案
- **Embedding 模型**：通过《大模型管理》菜单配置嵌入模型（支持硅基流动、OpenAI、本地 Ollama 等任意 OpenAI 兼容 API）
- **向量存储**：NumPy 余弦相似度 + JSON 文件持久化
- **未使用向量数据库**（ChromaDB 因 Python 3.14 兼容性问题已弃用）
- **未使用 LangChain 框架**（直接调用 OpenAI 兼容 API）

### 配置方式
Embedding 模型支持两种配置方式，优先级从高到低：
1. **数据库配置（推荐）**：在《大模型管理》页面新建"嵌入模型"类型的配置，设置 API Key、Base URL、模型名称，启用后自动生效
2. **环境变量 Fallback**：若数据库中无 active 的嵌入模型配置，则使用 `.env` 中的 `EMBEDDING_*` 配置

### 工作流程
1. **构建索引**：将所有已解析成功的简历结构化数据拼接为自然语言文本，调用 Embedding API 生成向量，持久化到本地 JSON 文件
2. **语义搜索**：用户输入自然语言查询 → 生成查询向量 → 与所有简历向量计算余弦相似度 → 返回 Top-K 匹配结果（含匹配度分数）
3. **自动向量化**：简历解析成功后自动调用向量化存储，无需手动操作

## 快速开始

### 环境要求
- Python 3.10+（已验证通过 Python 3.14）
- Node.js 18+（已验证通过 Node.js 24）
- Redis（Celery 异步任务所需）
- Ollama（本地 AI 模式所需，可选）

### 1. 安装 Redis

**Windows（推荐 winget）：**
```bash
winget install taizod1024.redis-windows-fork
```

**其他方式：** 参见 [Redis Windows 移植版](https://github.com/redis-windows/redis-windows)

启动 Redis 服务：
```bash
redis-server --port 6379
```

### 2. 安装 Ollama（本地 AI 模式）

如需使用本地 AI 功能（无需云端 API 费用），安装 Ollama 并拉取模型：

```bash
# 安装 Ollama：https://ollama.com/download
# 拉取对话模型（推荐 qwen2.5:3b，适合 8GB 内存）
ollama pull qwen2.5:3b
# 拉取嵌入模型
ollama pull qwen3-embedding:8b
```

> **内存建议**：8GB 内存推荐使用 3B 对话模型 + 8B 嵌入模型；16GB+ 内存可使用 7B 对话模型。

### 3. 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 生成密钥并配置环境变量（两种任选其一）
# 方式 A：使用脚本（推荐）
generate_keys.bat

# 方式 B：手动生成
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))" >> .env
python -c "import secrets; print('ENCRYPTION_KEY=' + secrets.token_urlsafe(32))" >> .env

# 编辑 .env 配置 Embedding 模型等参数（详见下方环境变量说明）

# 启动 API 服务（使用 python -m 方式，不要用 uvicorn 直接调用）
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 启动 Celery Worker（新终端）
celery -A app.tasks worker --loglevel=info --pool=solo
```

> **注意**：Celery 启动命令使用 `-A app.tasks`（而非 `-A app.core.celery_app`），以确保异步任务正确注册。
>
> **首次使用**：系统不会自动创建管理员账户。后端首次启动时会自动创建数据库表和 3 条默认提示词。创建 admin 用户：
> ```bash
> python -c "from app.db.session import SessionLocal; from app.models import User; from app.core.security import get_password_hash; db = SessionLocal(); u = User(username='admin', password_hash=get_password_hash('你的强密码')); db.add(u); db.commit()"
> ```

### 4. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173 即可使用。

### 一键启动（Windows）

双击 `backend/start_all.bat` 即可按顺序启动 Redis（检查）、后端 API、Celery Worker 和前端。脚本会自动检测 `.env` 是否存在且密钥已配置。

### 环境变量配置

后端 `.env` 主要配置项：

```env
# JWT 密钥（必填，使用上述命令生成）
SECRET_KEY=

# Token 过期时间（分钟）
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# 数据库
DATABASE_URL=sqlite:///./hr_ai.db

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# API Key 加密密钥（必填，使用上述命令生成）
ENCRYPTION_KEY=

# Embedding（AI 搜索，数据库配置后可省略）
# 云端 API 示例：
EMBEDDING_API_KEY=your-api-key
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=Qwen/Qwen3-VL-Embedding-8B

# 本地 Ollama 示例：
# EMBEDDING_API_KEY=ollama
# EMBEDDING_BASE_URL=http://localhost:11434/v1
# EMBEDDING_MODEL=qwen3-embedding:8b
```

## 大模型配置说明

系统支持两种 AI 接入方式，可在《大模型管理》页面灵活切换：

### 云端 API
- **提供商**：硅基流动、OpenAI、DeepSeek、智谱等任意 OpenAI 兼容 API
- **优点**：响应快、模型能力强
- **缺点**：需要付费、依赖网络

### 本地 Ollama
- **配置方式**：Base URL 填 `http://localhost:11434/v1`，API Key 填 `ollama`（占位符）
- **优点**：免费、数据不出本机、离线可用
- **缺点**：响应较慢（取决于硬件）、需要较多内存
- **推荐模型**：
  - 对话模型：`qwen2.5:3b`（8GB 内存）或 `qwen2.5:7b`（16GB+ 内存）
  - 嵌入模型：`qwen3-embedding:8b`

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 用户登录 |
| GET | `/api/v1/dashboard/stats` | 数据概览统计 |
| GET/POST/PUT/DELETE | `/api/v1/jobs` | 职位管理 |
| GET/POST | `/api/v1/resumes` | 简历管理 |
| POST | `/api/v1/resumes/import` | 简历导入 |
| POST | `/api/v1/ai-search` | AI 语义搜索 |
| POST | `/api/v1/ai-search/index` | 构建搜索索引 |
| POST | `/api/v1/matching/{id}/score` | 简历评分 |
| POST | `/api/v1/interviews/{id}/generate` | 生成面试题 |
| GET | `/api/v1/interviews/{id}/download/pdf` | 面试题 PDF 下载 |
| GET | `/api/v1/interviews/{id}/download/docx` | 面试题 DOCX 下载 |
| GET/POST/PUT | `/api/v1/prompts` | 提示词管理 |
| GET/POST/PUT/DELETE | `/api/v1/llm-configs` | 大模型配置管理 |

完整 API 文档：启动后端后访问 http://localhost:8000/docs

## 项目结构

```
AIHR/
├── backend/
│   ├── app/
│   │   ├── api/                # API 路由
│   │   │   ├── ai_search.py    # AI 搜索接口
│   │   │   ├── apply.py        # 应聘接口
│   │   │   ├── auth.py         # 认证接口
│   │   │   ├── dashboard.py    # 数据概览接口
│   │   │   ├── interviews.py   # 面试题接口
│   │   │   ├── jobs.py         # 职位接口
│   │   │   ├── llm_configs.py  # 大模型配置接口
│   │   │   ├── matching.py     # 匹配评分接口
│   │   │   ├── prompts.py      # 提示词接口
│   │   │   └── resumes.py      # 简历接口
│   │   ├── core/               # 核心配置
│   │   │   ├── celery_app.py   # Celery 配置
│   │   │   ├── config.py       # 应用配置（含启动校验）
│   │   │   └── security.py     # JWT / API Key 加密
│   │   ├── db/                 # 数据库会话
│   │   ├── models/             # SQLAlchemy 模型
│   │   ├── schemas/            # Pydantic Schema
│   │   ├── services/
│   │   │   └── vector_store.py # 向量存储服务（NumPy 实现）
│   │   └── tasks/              # Celery 异步任务
│   │       └── __init__.py     # parse_resume / score_resume / generate_interview
│   ├── chroma_db/              # 向量数据持久化目录（JSON）
│   ├── downloads/              # 导出文件目录
│   ├── uploads/                # 上传文件目录
│   ├── .env                    # 环境变量配置
│   ├── .env.example            # 环境变量模板
│   ├── generate_keys.bat       # 密钥生成脚本
│   ├── start_all.bat           # 一键启动脚本
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                # API 调用层
│   │   ├── components/         # 公共组件
│   │   ├── pages/              # 页面组件
│   │   │   ├── AiSearch/           # AI 搜索简历
│   │   │   ├── Apply/              # 应聘管理
│   │   │   ├── Dashboard/          # 数据概览
│   │   │   ├── InterviewQuestions/ # 面试题管理
│   │   │   ├── Jobs/               # 职位管理
│   │   │   ├── LLMConfigs/         # 大模型管理
│   │   │   ├── Login/              # 登录
│   │   │   ├── MatchingCenter/     # 匹配中心
│   │   │   ├── Prompts/            # 提示词管理
│   │   │   ├── ResumeDetail/       # 简历详情
│   │   │   ├── ResumeImport/       # 简历导入
│   │   │   └── Resumes/            # 简历管理
│   │   ├── router/             # 路由配置
│   │   ├── stores/             # 状态管理（Zustand）
│   │   └── types/              # TypeScript 类型
│   └── package.json
└── README.md
```

## 安全说明

本项目在生产部署前请注意以下安全事项：

- **`SECRET_KEY`** 和 **`ENCRYPTION_KEY`** 为必填项，无默认值。未配置时应用将拒绝启动并提示明确的中文错误信息。请使用 `secrets.token_urlsafe(32)` 生成随机密钥。
- **管理员账户**不会自动创建，需手动通过命令行创建并设置强密码。
- **CORS** 默认仅允许 `http://localhost:5173`（前端开发服务器），生产环境请修改为实际域名。
- **用户上传的简历文件**可能包含个人敏感信息，请勿提交至版本控制（已在 `.gitignore` 中排除）。
- **数据库文件**（`.db`）和 **Redis 快照**（`.rdb`）同样在 `.gitignore` 中排除。

## 启动注意事项

### 常见问题

| 问题 | 原因 | 解决方法 |
|------|------|----------|
| 启动时报 `RuntimeError: SECRET_KEY is not set` | `.env` 中密钥为空或未配置 | 运行 `generate_keys.bat` 或在 `.env` 中手动填写 |
| `uvicorn: command not found` | uvicorn 未加入 PATH | 使用 `python -m uvicorn` 替代 |
| 前端 404 加载 favicon | `vite.svg` 文件不存在 | 已移除该引用 |
| 登录后页面空白 | 后端未启动或端口不一致 | 确认后端运行在 8000 端口，前端 dev server 已配置代理 |
| Celery 任务不执行 | Celery Worker 未启动 | 在新终端运行 `celery -A app.tasks worker --loglevel=info --pool=solo` |
| 向量搜索返回空结果 | 未配置 Embedding 模型 | 在《大模型管理》页面配置嵌入模型，或重新构建索引 |

### 全新克隆后的标准启动流程

1. `cp backend/.env.example backend/.env`（或复制后手动编辑）
2. 运行 `generate_keys.bat` 生成 `SECRET_KEY` 和 `ENCRYPTION_KEY`
3. 编辑 `.env` 配置 Embedding 模型（云端或本地 Ollama）
4. `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
5. 创建 admin 用户（见上方命令）
6. `cd frontend && npm run dev`

## License

MIT
