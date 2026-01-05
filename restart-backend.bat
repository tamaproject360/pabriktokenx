@echo off
title CLI Proxy API - Restart Server
color 0E

echo ============================================
echo    CLI Proxy API - Restart Server
echo ============================================
echo.

cd /d "%~dp0"

:: Stop existing server first
echo [INFO] Stopping existing server...
taskkill /F /IM go.exe >nul 2>nul
echo [INFO] Waiting for process to stop...
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
echo [INFO] Server will run on http://localhost:8080
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
