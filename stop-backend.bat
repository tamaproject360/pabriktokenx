@echo off
title CLI Proxy API - Stop Server
color 0C

:: Run PowerShell script for better process management
powershell -ExecutionPolicy Bypass -File "%~dp0stop-backend.ps1"

pause
