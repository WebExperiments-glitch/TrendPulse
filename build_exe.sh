#!/usr/bin/env bash
# 一键构建 TrendPulse Windows 独立可执行程序 (PyInstaller onefile)
# 前置: Python 3.11+, Node.js 20.19+
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> [1/3] 构建前端 frontend/dist"
cd frontend
npm install
npm run build
cd "$ROOT"

echo "==> [2/3] 准备 Python 虚拟环境与依赖"
python -m venv .venv
if [ -f ".venv/Scripts/activate" ]; then
  # shellcheck disable=SC1091
  source .venv/Scripts/activate   # Windows (Git Bash)
else
  # shellcheck disable=SC1091
  source .venv/bin/activate       # macOS / Linux
fi
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
pip install pyinstaller

echo "==> [3/3] PyInstaller 打包 (TrendPulse.spec)"
pyinstaller TrendPulse.spec --noconfirm

echo ""
echo "完成 -> dist_exe/TrendPulse.exe"
