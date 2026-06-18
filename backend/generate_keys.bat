@echo off
REM 自动生成 SECRET_KEY 和 ENCRYPTION_KEY
REM 用法: generate_keys.bat
REM 会保留 .env 中已有的配置，仅更新密钥字段

python -c "
import secrets
secret = secrets.token_urlsafe(32)
enc = secrets.token_urlsafe(32)

lines = []
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('SECRET_KEY='):
            lines.append('SECRET_KEY=' + secret + '\n')
        elif line.startswith('ENCRYPTION_KEY='):
            lines.append('ENCRYPTION_KEY=' + enc + '\n')
        else:
            lines.append(line)

with open('.env', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Done')
"

echo.
echo 密钥已更新到 .env 文件
echo 请编辑 .env 配置其他参数（如 Embedding 模型等）
pause
