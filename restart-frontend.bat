@echo off
title CLI Proxy API - Restart Frontend
color 0E

echo ============================================
echo    CLI Proxy API - Restart Frontend
echo ============================================
echo.

cd /d "%~dp0"

:: Stop existing frontend server
echo [INFO] Stopping existing frontend server...
taskkill /F /FI "WINDOWTITLE eq CLI Proxy API - Frontend*" >nul 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [INFO] Starting Frontend Dev Server...

:: Start frontend in new window
start "CLI Proxy API - Frontend" cmd /k "start-frontend.bat"

echo.
echo [SUCCESS] Frontend restarted successfully!
echo.
pause
