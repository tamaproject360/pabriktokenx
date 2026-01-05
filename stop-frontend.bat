@echo off
title CLI Proxy API - Stop Frontend
color 0C

echo ============================================
echo    CLI Proxy API - Stop Frontend
echo ============================================
echo.

:: Find and kill Node.js process running in frontend directory
echo [INFO] Stopping CLI Proxy API frontend...
taskkill /F /FI "WINDOWTITLE eq CLI Proxy API - Frontend*" >nul 2>nul

:: Also kill any node processes running npm dev
FOR /F "tokens=2" %%A IN ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr "PID"') DO (
    taskkill /F /PID %%A >nul 2>nul
)

echo [SUCCESS] Frontend stopped successfully!
echo.
pause
