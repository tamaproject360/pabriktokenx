@echo off
title CLI Proxy API - Stop All Services
color 0C

echo ============================================
echo    CLI Proxy API - Stop All Services
echo ============================================
echo.

:: Stop Backend
echo [INFO] Stopping Backend Server...
taskkill /F /IM go.exe >nul 2>nul
taskkill /F /IM cliproxy.exe >nul 2>nul
echo [OK] Backend stopped

:: Stop Frontend  
echo [INFO] Stopping Frontend Server...
taskkill /F /FI "WINDOWTITLE eq CLI Proxy API - Frontend*" >nul 2>nul
FOR /F "tokens=2" %%A IN ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr "PID"') DO (
    taskkill /F /PID %%A >nul 2>nul
)
echo [OK] Frontend stopped

echo.
echo ============================================
echo [SUCCESS] All services stopped successfully!
echo ============================================
echo.
pause
