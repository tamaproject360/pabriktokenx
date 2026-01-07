@echo off
title CLI Proxy API - Restart Server
color 0E

echo ============================================
echo    CLI Proxy API - Restart Server
echo ============================================
echo.

cd /d "%~dp0"

:: Stop all existing backend processes
echo [INFO] Stopping existing backend processes...

taskkill /F /IM main.exe >nul 2>nul
taskkill /F /IM server.exe >nul 2>nul
taskkill /F /IM go.exe >nul 2>nul
taskkill /F /IM cliproxy.exe >nul 2>nul

:: Kill process on port 9999
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9999 ^| findstr LISTENING') do (
    echo [INFO] Killing process on port 9999 (PID %%a)
    taskkill /F /PID %%a >nul 2>nul
)

echo [INFO] Waiting for processes to stop...
timeout /t 3 /nobreak >nul

echo.

:: Check if Go is installed
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Go is not installed or not in PATH
    pause
    exit /b 1
)

:: Check if config.yaml exists
if not exist "config.yaml" (
    echo [WARN] config.yaml not found, copying from config.example.yaml...
    copy config.example.yaml config.yaml
)

echo [INFO] Starting CLI Proxy API Server...
echo [INFO] Server will run on http://localhost:9999
echo [INFO] Management Key: admin123
echo [INFO] Press Ctrl+C to stop the server
echo.
echo ============================================

:: Set Go path and run the server directly
set "PATH=C:\Program Files\Go\bin;%PATH%"
go run ./cmd/server -config config.yaml

:: Keep terminal open if server crashes
echo.
echo [INFO] Server stopped.
pause
