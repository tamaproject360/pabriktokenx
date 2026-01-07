@echo off
title CLI Proxy API - Stop All Services
color 0C

:: Run PowerShell script for better process management
powershell -ExecutionPolicy Bypass -File "%~dp0stop-all.ps1"

pause
