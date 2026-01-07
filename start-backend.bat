@echo off
title CLI Proxy API - Backend Server
color 0A

echo ============================================
echo    CLI Proxy API - Backend Server
echo ============================================
echo.

cd /d "%~dp0"

:: Stop any existing backend processes first
echo [INFO] Checking for existing backend processes...
taskkill /F /IM main.exe >nul 2>nul
taskkill /F /IM server.exe >nul 2>nul
taskkill /F /IM go.exe >nul 2>nul

:: Kill any process on port 9999
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9999 ^| findstr LISTENING') do (
    echo [INFO] Stopping process on port 9999 (PID %%a)
    taskkill /F /PID %%a >nul 2>nul
)

timeout /t 2 /nobreak >nul
echo [INFO] Existing processes cleaned up.
echo.

:: Check if Go is installed
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Go is not installed or not in PATH
    echo Please install Go from https://go.dev/dl/
    pause
    exit /b 1
)

echo [INFO] Go version:
go version
echo.

:: Check if config.yaml exists
if not exist "config.yaml" (
    echo [WARN] config.yaml not found, copying from config.example.yaml...
    copy config.example.yaml config.yaml
)

echo [INFO] Building server...
go build -o cliproxy.exe ./cmd/server

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo [INFO] Build successful!
echo.
echo [INFO] Starting CLI Proxy API Server...
echo [INFO] Server will run on http://localhost:9999
echo [INFO] Management Key: admin123
echo [INFO] Press Ctrl+C to stop the server
echo.
echo ============================================

:: Set Go path and run the server directly (no build)
set "PATH=C:\Program Files\Go\bin;%PATH%"
go run ./cmd/server -config config.yaml

:: Keep terminal open if server crashes
echo.
echo [INFO] Server stopped.
pause
