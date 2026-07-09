@echo off
REM 一键构建 TrendPulse Windows 独立可执行程序 (PyInstaller onefile)
REM 前置: Python 3.11+, Node.js 20.19+
setlocal
cd /d %~dp0

echo ==[1/3] 构建前端 frontend/dist
cd frontend
call npm install
call npm run build
cd ..

echo ==[2/3] 准备 Python 虚拟环境与依赖
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
pip install pyinstaller

echo ==[3/3] PyInstaller 打包 (TrendPulse.spec)
pyinstaller TrendPulse.spec --noconfirm

echo.
echo 完成 -^> dist_exe\TrendPulse.exe
endlocal
