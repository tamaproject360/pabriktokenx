@echo off
title CLI Proxy API - Frontend Dev Server
color 0B

echo ============================================
echo    CLI Proxy API - Frontend Dashboard
echo ============================================
echo.

cd /d "%~dp0frontend"

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js version:
node --version
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)

echo [INFO] Starting Frontend Dev Server...
echo [INFO] Frontend will run on http://localhost:8686
echo [INFO] Make sure backend is running on http://localhost:9999
echo [INFO] Press Ctrl+C to stop the server
echo.
echo ============================================

npm run dev

:: Keep terminal open
echo.
echo [INFO] Frontend server stopped.
pause
