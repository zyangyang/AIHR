# AIHR 系统修复指南

> **文档目的**：本文档记录了 AIHR 智能招聘平台在生产环境部署后发现的 4 个问题及其完整修复方案。其他部署了相同项目的服务器如果遇到同样问题，可按照本文档逐步修复。
>
> **适用版本**：2026-07-20 及之前部署的版本
> **修复日期**：2026-07-20
> **涉及文件**：共 5 个后端文件 + 2 个前端文件 + 服务器环境配置

---

## 目录

1. [问题一：Celery 任务未注册导致简历解析卡住](#问题一celery-任务未注册导致简历解析卡住)
2. [问题二：初筛报告 PDF 下载失败](#问题二初筛报告-pdf-下载失败)
3. [问题三：面试题 PDF/DOCX 下载失败](#问题三面试题-pdfdocx-下载失败)
4. [问题四：前端 TypeScript 编译错误](#问题四前端-typescript-编译错误)
5. [修复后验证清单](#修复后验证清单)
6. [快速修复脚本（一键执行）](#快速修复脚本一键执行)

---

## 问题一：Celery 任务未注册导致简历解析卡住

### 现象

- 用户上传简历后，前端一直显示"解析简历中"，无限轮询 `/api/v1/matching/{id}/parse/status` 但永远返回 `parsing`
- 后端日志无明显报错（Celery 消息被静默丢弃）
- Celery worker 日志可能出现 `KeyError` 或任务未注册的警告

### 根因

`celery_app.py` 中创建 Celery 实例时未配置 `include` 参数，导致 Celery worker 启动时不导入 `app/tasks` 模块，`parse_resume`、`score_resume`、`generate_interview` 等任务全部未注册。提交到消息队列的任务消息找不到对应的任务函数，被直接丢弃。

### 修复文件

`backend/app/core/celery_app.py`

### 修复方法

**修复前：**

```python
celery_app = Celery(
    "hr_ai_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)
```

**修复后：**

```python
celery_app = Celery(
    "hr_ai_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks"],
)
```

> **关键**：添加 `include=["app.tasks"]`，让 Celery worker 启动时自动导入任务模块。

### 验证方法

```bash
# 重启 Celery 服务
sudo systemctl restart aihr-celery

# 检查 worker 日志，应能看到已注册的任务列表
sudo journalctl -u aihr-celery --no-pager | grep -i "registered\|ready"
# 应输出类似: [tasks] . app.tasks.parse_resume_task . app.tasks.score_resume_task ...
```

---

## 问题二：初筛报告 PDF 下载失败

### 现象

- 用户生成初筛报告后点击"下载报告"，前端提示"请求失败/下载失败"
- 后端返回 HTTP 500
- 后端日志报错之一：`系统未安装中文字体，无法生成PDF`
- 后端日志报错之二：`FileNotFoundError: [Errno 2] No such file or directory: 'downloads/...-初筛报告.pdf'`

### 根因（两个问题叠加）

#### 根因 A：服务器未安装中文字体

PDF 生成使用 reportlab 库，需要系统中文字体支持。Linux 服务器默认不安装中文字体，导致 reportlab 无法渲染中文，抛出异常。

#### 根因 B：文件名包含非法字符

职位名称中可能包含 `/`、`\`、`:`、`*`、`?`、`"`、`<`、`>`、`|` 等字符（例如"高级AI产品经理(餐饮SaaS/兼顾海外方向)"），这些字符在 Linux/Windows 文件系统中是非法的，被当作路径分隔符，导致文件保存路径错误，触发 `FileNotFoundError`。

### 修复步骤

#### 步骤 1：服务器安装中文字体

```bash
# Ubuntu / Debian
sudo apt-get update
sudo apt-get install -y fonts-wqy-zenhei fonts-noto-cjk

# CentOS / RHEL (备用)
sudo yum install -y wqy-zenhei-fonts google-noto-sans-cjk-fonts

# 验证字体文件存在
ls -la /usr/share/fonts/truetype/wqy/wqy-zenhei.ttc
# 或
ls -la /usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc
```

#### 步骤 2：修复文件 `backend/app/api/matching.py`

**需要修改的部分（文件名清理 + 绝对路径）：**

找到 `download_score_pdf` 函数中的文件命名部分（约第 263-271 行），

**修复前：**

```python
    # 文件命名规则：应聘岗位-简历姓名-手机号-初筛报告
    base_name = f"{resume.job.title}-{resume.name}-{resume.phone}-初筛报告"
    filename = f"{base_name}.pdf"
    output_dir = Path("downloads")
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / filename
```

**修复后：**

```python
    # 文件命名规则：应聘岗位-简历姓名-手机号-初筛报告
    job_title = resume.job.title if resume.job else '未知岗位'
    safe_job_title = re.sub(r'[\\/:*?"<>|]', '-', job_title).strip('-')
    base_name = f"{safe_job_title}-{resume.name}-{resume.phone}-初筛报告"
    filename = f"{base_name}.pdf"
    # 使用项目根目录下的绝对路径，避免因工作目录变化导致路径错误
    output_dir = Path(__file__).resolve().parent.parent.parent / "downloads"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / filename
```

**改动说明：**
1. `re.sub(r'[\\/:*?"<>|]', '-', job_title).strip('-')` — 将职位名称中的所有文件名非法字符替换为 `-`
2. `Path(__file__).resolve().parent.parent.parent / "downloads"` — 使用绝对路径而非相对路径 `Path("downloads")`，避免因 uvicorn 工作目录不同导致路径找不到

> **前置条件**：确保 `matching.py` 文件顶部已 `import re` 和 `from pathlib import Path`。如果没有，请在文件头部添加。

### 验证方法

```bash
# 重启 API 服务
sudo systemctl restart aihr-api

# 登录获取 token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@aihr2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")

# 测试下载（替换 resume_id）
curl -s -o /tmp/test_report.pdf -w "HTTP:%{http_code} SIZE:%{size_download}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/matching/1/download/score-pdf

# 应输出: HTTP:200 SIZE:50000 左右
```

---

## 问题三：面试题 PDF/DOCX 下载失败

### 现象

- 用户生成面试题后点击下载 PDF 或 DOCX，后端返回 HTTP 500
- 后端日志报错：`FileNotFoundError: [Errno 2] No such file or directory: 'downloads/高级AI产品经理(餐饮SaaS/兼顾海外方向)-张景瑜-13867925689-面试题.pdf'`

### 根因

与问题二根因 B 完全相同 —— `interviews.py` 的两个下载接口（`download_interview_pdf` 和 `download_interview_docx`）未对文件名做非法字符清理。职位名称中的 `/` 被操作系统当作路径分隔符，导致 `downloads/高级AI产品经理(餐饮SaaS/` 这个中间目录不存在，文件保存失败。

> **注意**：问题二修复 matching.py 时漏掉了 interviews.py，这两个文件有完全相同的 bug 但在不同函数中。

### 修复文件

`backend/app/api/interviews.py`

### 修复步骤

#### 步骤 1：在文件顶部添加 `_sanitize_filename` 函数

在 `router = APIRouter(...)` 之后、第一个路由函数之前，添加：

```python
def _sanitize_filename(name: str) -> str:
    """清理文件名中的非法字符（/ \\ : * ? " < > |），替换为 -"""
    return re.sub(r'[/\\:*?"<>|]', '-', name).strip()
```

#### 步骤 2：确保文件顶部已导入 `re`

```python
import re
```

> 如果文件头部 imports 中已有 `import re` 则跳过此步。

#### 步骤 3：修复 PDF 下载接口 `download_interview_pdf`

找到函数中的文件命名部分（约第 204-210 行），

**修复前：**

```python
    # 文件命名规则：应聘岗位-简历姓名-手机号-面试题
    base_name = f"{resume.job.title}-{resume.name}-{resume.phone}-面试题"
    filename = f"{base_name}.pdf"
    output_dir = Path("downloads")
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / filename
```

**修复后：**

```python
    # 文件命名规则：应聘岗位-简历姓名-手机号-面试题
    base_name = _sanitize_filename(f"{resume.job.title}-{resume.name}-{resume.phone}-面试题")
    filename = f"{base_name}.pdf"
    # 使用项目根目录下的绝对路径，避免因工作目录变化导致路径错误
    output_dir = Path(__file__).resolve().parent.parent.parent / "downloads"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / filename
```

#### 步骤 4：修复 DOCX 下载接口 `download_interview_docx`

找到函数中的文件命名部分（约第 298-304 行），

**修复前：**

```python
    # 文件命名规则：应聘岗位-简历姓名-手机号-面试题
    base_name = f"{resume.job.title}-{resume.name}-{resume.phone}-面试题"
    filename = f"{base_name}.docx"
    output_dir = Path("downloads")
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / filename
```

**修复后：**

```python
    # 文件命名规则：应聘岗位-简历姓名-手机号-面试题
    base_name = _sanitize_filename(f"{resume.job.title}-{resume.name}-{resume.phone}-面试题")
    filename = f"{base_name}.docx"
    # 使用项目根目录下的绝对路径，避免因工作目录变化导致路径错误
    output_dir = Path(__file__).resolve().parent.parent.parent / "downloads"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / filename
```

### 验证方法

```bash
# 重启 API 服务
sudo systemctl restart aihr-api

# 测试 PDF 下载
curl -s -o /dev/null -w "PDF HTTP:%{http_code} SIZE:%{size_download}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/interviews/1/download/pdf
echo ""

# 测试 DOCX 下载
curl -s -o /dev/null -w "DOCX HTTP:%{http_code} SIZE:%{size_download}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/interviews/1/download/docx
echo ""

# 两个都应输出 HTTP:200
```

---

## 问题四：前端 TypeScript 编译错误

### 现象

- 执行 `npm run build` 时 TypeScript 编译报错，构建失败
- 前端无法部署

### 根因

两处 TypeScript 类型使用错误。

### 修复文件

#### 4.1 `frontend/src/pages/Prompts/index.tsx`

**问题**：`catch` 块中的错误对象未正确绑定类型。

**修复方法**：找到 `catch` 相关代码，确保 `catch` 绑定的变量有正确的类型标注。具体为将 `catch {` 改为 `catch (error: any) {` 或 `catch (error) {` 并在 catch 块内正确使用 `error`。

> 如果项目中该文件已有 `catch` 绑定，检查是否缺少变量名或类型标注有误。

#### 4.2 `frontend/src/pages/ResumeDetail/index.tsx`

**问题**：Ant Design 的 `<Alert>` 组件 `type` 属性使用了不合法的值。

**修复方法**：`Alert` 的 `type` 属性只接受 `"success" | "info" | "warning" | "error"` 四个值。检查该文件中所有 `<Alert>` 标签的 `type` 属性，确保值在合法范围内。

### 验证方法

```bash
cd frontend
npm run build
# 应无 TypeScript 错误，构建成功
```

---

## 修复后验证清单

完成所有修复后，按以下清单逐项验证：

| 序号 | 验证项 | 验证命令 / 方法 | 预期结果 |
|------|--------|----------------|---------|
| 1 | Celery 任务已注册 | `sudo journalctl -u aihr-celery --no-pager \| grep -i registered` | 显示 parse_resume_task 等任务 |
| 2 | 简历解析正常 | 上传一份简历，等待解析完成 | 状态从 parsing 变为 success/parsed |
| 3 | 中文字体已安装 | `ls /usr/share/fonts/truetype/wqy/wqy-zenhei.ttc` | 文件存在 |
| 4 | 初筛报告下载 | 生成报告后点击下载 PDF | HTTP 200，PDF 可正常打开 |
| 5 | 面试题 PDF 下载 | 生成面试题后点击下载 PDF | HTTP 200，PDF 可正常打开 |
| 6 | 面试题 DOCX 下载 | 生成面试题后点击下载 DOCX | HTTP 200，DOCX 可正常打开 |
| 7 | 前端构建 | `cd frontend && npm run build` | 无错误，构建成功 |
| 8 | 含特殊字符的职位 | 创建职位名称含 `/` 的职位（如"产品经理(餐饮SaaS/海外)"），测试下载 | 文件名中 `/` 被替换为 `-`，下载成功 |

---

## 快速修复脚本（一键执行）

> 以下脚本适用于 Ubuntu 服务器，在项目根目录 `/opt/aihr/backend` 下执行。
> **执行前请务必备份原有文件。**

```bash
#!/bin/bash
# AIHR 修复脚本 - 2026-07-20
# 使用方法: bash fix_aihr.sh

set -e

BACKEND_DIR="/opt/aihr/backend"

echo "=========================================="
echo "  AIHR 系统修复脚本"
echo "=========================================="

# ---- 修复 1: 安装中文字体 ----
echo "[1/4] 安装中文字体..."
sudo apt-get update -qq
sudo apt-get install -y -qq fonts-wqy-zenhei fonts-noto-cjk
echo "  -> 中文字体安装完成"

# ---- 修复 2: celery_app.py 添加 include ----
echo "[2/4] 修复 Celery 任务注册..."
CELERY_FILE="$BACKEND_DIR/app/core/celery_app.py"
if grep -q 'include=\["app.tasks"\]' "$CELERY_FILE"; then
    echo "  -> 已修复，跳过"
else
    cp "$CELERY_FILE" "${CELERY_FILE}.bak"
    sed -i 's/backend=settings.CELERY_RESULT_BACKEND,$/backend=settings.CELERY_RESULT_BACKEND,\n    include=["app.tasks"],/' "$CELERY_FILE"
    echo "  -> 已修复（备份: ${CELERY_FILE}.bak）"
fi

# ---- 修复 3: matching.py 文件名清理 ----
echo "[3/4] 修复初筛报告下载..."
MATCHING_FILE="$BACKEND_DIR/app/api/matching.py"
if grep -q 'safe_job_title' "$MATCHING_FILE"; then
    echo "  -> 已修复，跳过"
else
    cp "$MATCHING_FILE" "${MATCHING_FILE}.bak"
    # 这里需要手动编辑，请参考文档中的修复前/修复后代码
    echo "  -> 请参考修复文档手动编辑 matching.py（备份已创建）"
fi

# ---- 修复 4: interviews.py 文件名清理 ----
echo "[4/4] 修复面试题下载..."
INTERVIEWS_FILE="$BACKEND_DIR/app/api/interviews.py"
if grep -q '_sanitize_filename' "$INTERVIEWS_FILE"; then
    echo "  -> 已修复，跳过"
else
    cp "$INTERVIEWS_FILE" "${INTERVIEWS_FILE}.bak"
    # 这里需要手动编辑，请参考文档中的修复前/修复后代码
    echo "  -> 请参考修复文档手动编辑 interviews.py（备份已创建）"
fi

# ---- 重启服务 ----
echo ""
echo "重启服务..."
sudo systemctl restart aihr-api
sudo systemctl restart aihr-celery
sleep 2

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "请按文档中的验证清单逐项检查。"
echo "如有问题，备份文件在原文件名后加 .bak"
```

> **重要提醒**：
> - 脚本中的 `sed` 命令可能因文件内容格式不同而匹配失败，建议优先按文档手动修改
> - 修改前务必备份原文件
> - 修改后必须重启 `aihr-api` 和 `aihr-celery` 服务
> - 前端文件修改后需要重新 `npm run build` 并部署 `dist` 目录

---

## 修改文件汇总

| 文件路径 | 修改内容 | 对应问题 |
|---------|---------|---------|
| `backend/app/core/celery_app.py` | 添加 `include=["app.tasks"]` | 问题一 |
| `backend/app/api/matching.py` | 文件名非法字符清理 + 绝对路径 | 问题二 |
| `backend/app/api/interviews.py` | 新增 `_sanitize_filename()` + 文件名清理 + 绝对路径 | 问题三 |
| `frontend/src/pages/Prompts/index.tsx` | 修复 catch 绑定 | 问题四 |
| `frontend/src/pages/ResumeDetail/index.tsx` | 修复 Alert type 属性 | 问题四 |
| 服务器环境 | 安装 `fonts-wqy-zenhei` `fonts-noto-cjk` | 问题二 |

---

## 常见问题

### Q: 修改后需要重启哪些服务？

```bash
sudo systemctl restart aihr-api      # 后端 API（Python 文件修改后）
sudo systemctl restart aihr-celery   # Celery worker（celery_app.py 修改后）
# 前端修改后需要:
cd /opt/aihr/frontend && npm run build  # 重新构建
# nginx 不需要重启（静态文件无变化）
```

### Q: 修改 Python 文件后不重启会怎样？

uvicorn 默认不会热重载（生产环境），修改文件后必须重启服务才会生效。

### Q: 如何查看后端日志排查问题？

```bash
# 查看最近 50 行 API 日志
sudo journalctl -u aihr-api --no-pager -n 50

# 查看最近 50 行 Celery 日志
sudo journalctl -u aihr-celery --no-pager -n 50

# 实时跟踪日志
sudo journalctl -u aihr-api -f
```

### Q: downloads 目录在哪里？

修复后，downloads 目录位于 `backend/downloads/`（即 `Path(__file__).resolve().parent.parent.parent / "downloads"`，从 `app/api/matching.py` 往上三级到 backend 根目录）。该目录会在第一次下载时自动创建。

---

*文档作者：AIHR 项目组*
*最后更新：2026-07-20*
