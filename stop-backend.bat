@echo off
title CLI Proxy API - Stop Server
color 0C

echo ============================================
echo    CLI Proxy API - Stop Server
echo ============================================
echo.

:: Find and kill Go process (backend runs with go run)
echo [INFO] Stopping CLI Proxy API server...
taskkill /F /IM go.exe >nul 2>nul
if %ERRORLEVEL%==0 (
    echo [SUCCESS] Server stopped successfully!
) else (
    echo [INFO] No running CLI Proxy API server found.
)

echo.
pause
