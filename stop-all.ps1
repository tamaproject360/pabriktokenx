#!/usr/bin/env pwsh
# CLI Proxy API - Stop All Services (PowerShell)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   CLI Proxy API - Stop All Services" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Stop Backend
Write-Host "[INFO] Stopping Backend Server..." -ForegroundColor Yellow
$backendProcesses = @('main', 'server', 'go', 'cliproxy')
$killedBackend = $false

foreach ($name in $backendProcesses) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($procs) {
        foreach ($proc in $procs) {
            Write-Host "  [OK] Stopping $($proc.ProcessName) (PID $($proc.Id))" -ForegroundColor Green
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killedBackend = $true
        }
    }
}

# Kill process on port 9999
$connections = netstat -ano | Select-String ":9999.*LISTENING"
if ($connections) {
    foreach ($conn in $connections) {
        $parts = $conn.ToString() -split '\s+' | Where-Object { $_ -ne '' }
        $pid = $parts[-1]
        if ($pid -match '^\d+$') {
            try {
                $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  [OK] Stopping process on port 9999: $($proc.ProcessName) (PID $pid)" -ForegroundColor Green
                    Stop-Process -Id $pid -Force
                    $killedBackend = $true
                }
            } catch {
                # Ignore
            }
        }
    }
}

if (-not $killedBackend) {
    Write-Host "  [INFO] No backend process found" -ForegroundColor Gray
}

Write-Host ""

# Stop Frontend
Write-Host "[INFO] Stopping Frontend Server..." -ForegroundColor Yellow
$killedFrontend = $false

# Kill Vite dev server (node.exe with specific port)
$connections = netstat -ano | Select-String ":8686.*LISTENING"
if ($connections) {
    foreach ($conn in $connections) {
        $parts = $conn.ToString() -split '\s+' | Where-Object { $_ -ne '' }
        $pid = $parts[-1]
        if ($pid -match '^\d+$') {
            try {
                $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  [OK] Stopping process on port 8686: $($proc.ProcessName) (PID $pid)" -ForegroundColor Green
                    Stop-Process -Id $pid -Force
                    $killedFrontend = $true
                }
            } catch {
                # Ignore
            }
        }
    }
}

if (-not $killedFrontend) {
    Write-Host "  [INFO] No frontend process found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] All services stopped!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
