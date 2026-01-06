@echo off
title CLI Proxy API - Start All Services
color 0A

echo ============================================
echo    CLI Proxy API - Start All Services
echo ============================================
echo.

cd /d "%~dp0"

:: Start Backend in new window
echo [INFO] Starting Backend Server...
start "CLI Proxy API - Backend" cmd /k "start-backend.bat"

:: Wait for backend to initialize
echo [INFO] Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

:: Start Frontend in new window
echo [INFO] Starting Frontend Dev Server...
start "CLI Proxy API - Frontend" cmd /k "start-frontend.bat"

echo.
echo ============================================
echo [SUCCESS] All services started!
echo.
echo Backend:  http://localhost:9999
echo Frontend: http://localhost:8686
echo.
echo Management Key: admin123
echo ============================================
echo.

pause
