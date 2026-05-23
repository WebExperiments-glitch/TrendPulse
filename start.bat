@echo off

REM Start script for GitHub trending crawler
REM This script starts the backend and frontend servers

echo =============================
echo TrendPulse V0.1

echo =============================
echo.

REM Set directories
set "BACKEND=backend"
set "FRONTEND=frontend"

echo Checking ports...

REM Check if port 5000 is available
netstat -ano | findstr :5000 > nul
if %errorlevel% equ 0 (
    echo ERROR: Port 5000 is in use!
    echo Please close the service using this port.
    echo.
    pause
    exit /b 1
) else (
    echo Port 5000 is available
)

REM Check if port 5173 is available
netstat -ano | findstr :5173 > nul
if %errorlevel% equ 0 (
    echo ERROR: Port 5173 is in use!
    echo Please close the service using this port.
    echo.
    pause
    exit /b 1
) else (
    echo Port 5173 is available
)
echo.

echo Checking dependencies...

REM Check backend requirements
if exist "%BACKEND%\requirements.txt" (
    echo Backend requirements file found
) else (
    echo ERROR: Backend requirements.txt not found!
    echo.
    pause
    exit /b 1
)

REM Check frontend package.json
if exist "%FRONTEND%\package.json" (
    echo Frontend package.json found
) else (
    echo ERROR: Frontend package.json not found!
    echo.
    pause
    exit /b 1
)

REM Check frontend node_modules
if not exist "%FRONTEND%\node_modules" (
    echo Installing frontend dependencies...
    cd "%FRONTEND%"
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Frontend dependency installation failed!
        echo.
        pause
        exit /b 1
    )
    cd ..
    echo Frontend dependencies installed
) else (
    echo Frontend dependencies exist
)

REM Check backend Python dependencies
python -c "import flask; import flask_cors; import requests; import bs4; import apscheduler" > nul 2>&1
if %errorlevel% neq 0 (
    echo Installing backend dependencies...
    cd "%BACKEND%"
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo ERROR: Backend dependency installation failed!
        echo.
        pause
        exit /b 1
    )
    cd ..
    echo Backend dependencies installed
) else (
    echo Backend dependencies exist
)
echo.

echo Starting backend server...
start "Backend Server" cmd /k "cd %BACKEND% && python app.py"

timeout /t 2 /nobreak > nul

echo Starting frontend server...
start "Frontend Server" cmd /k "cd %FRONTEND% && npm run dev"

timeout /t 5 /nobreak > nul

echo Opening web page...
start http://localhost:5173

echo.
echo =============================
echo Startup complete!
echo =============================
echo TrendPulse V0.1 - 开源趋势分析
echo =============================
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo Notes:
echo 1. Server windows will remain open
echo 2. Close windows to stop servers
echo 3. Check ports if startup fails
echo.
pause