#!/usr/bin/env pwsh
# CLI Proxy API - Stop Backend Server (PowerShell)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   CLI Proxy API - Stop Backend Server" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$processNames = @('main', 'server', 'go', 'cliproxy')
$killedAny = $false

foreach ($name in $processNames) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($procs) {
        foreach ($proc in $procs) {
            Write-Host "[INFO] Stopping $($proc.ProcessName) (PID $($proc.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killedAny = $true
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
                    Write-Host "[INFO] Stopping process on port 9999: $($proc.ProcessName) (PID $pid)..." -ForegroundColor Yellow
                    Stop-Process -Id $pid -Force
                    $killedAny = $true
                }
            } catch {
                # Ignore errors
            }
        }
    }
}

Write-Host ""
if ($killedAny) {
    Write-Host "[SUCCESS] Backend server stopped!" -ForegroundColor Green
} else {
    Write-Host "[INFO] No running backend server found." -ForegroundColor Gray
}
Write-Host ""
