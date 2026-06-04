# BuildRadar - Local Dev Starter
# Runs API + Web natively with hot reload; Redis in Docker
#
# Prerequisites:
#   - Docker Desktop running
#   - Python venv in apps/api/.venv  (or 'venv')
#   - Node modules installed in apps/web/node_modules
#
# Usage: .\dev.ps1 [stop]
#   .\dev.ps1        - start everything
#   .\dev.ps1 stop   - stop Redis and kill API/Web processes

param([string]$Command = "start")

$Root = $PSScriptRoot

function Write-Step($msg) {
    Write-Host "  $msg" -ForegroundColor Cyan
}
function Write-Ok($msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}
function Write-Warn($msg) {
    Write-Host "  [!]  $msg" -ForegroundColor Yellow
}

# -- STOP ----------------------------------------------------------------------
if ($Command -eq "stop") {
    Write-Host "`nStopping BuildRadar..." -ForegroundColor Yellow
    docker compose -f "$Root\docker-compose.infra.yml" down
    # Kill uvicorn and next dev processes
    Get-Process -Name "python" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*uvicorn*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "node" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*next*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  Done.`n" -ForegroundColor Green
    exit 0
}

# -- START ---------------------------------------------------------------------
Write-Host "`nBuildRadar Local Dev" -ForegroundColor Magenta
Write-Host "----------------------------------------`n"

# 1. Start Redis (optional - app works without it)
Write-Step "Starting Redis (optional)..."
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Warn "Docker not found - Redis skipped. Caching will be disabled (app works fine)."
} else {
    docker compose -f "$Root\docker-compose.infra.yml" up -d *>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Redis running on localhost:6379"
    } else {
        Write-Warn "Docker failed to start Redis - caching disabled (app works fine)."
    }
}

# 2. Check API env
$ApiEnv = "$Root\apps\api\.env"
if (-not (Test-Path $ApiEnv)) {
    Write-Warn "apps/api/.env not found - copy apps/api/.env.example and fill in values"
    exit 1
}

# 3. Resolve Python executable inside venv
$VenvPy = $null
foreach ($venvPath in @("$Root\apps\api\.venv\Scripts\python.exe", "$Root\apps\api\venv\Scripts\python.exe")) {
    if (Test-Path $venvPath) { $VenvPy = $venvPath; break }
}
if (-not $VenvPy) {
    $VenvPy = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $VenvPy) {
        Write-Warn "Python not found. Create a venv: cd apps/api; python -m venv .venv; .venv\Scripts\activate; pip install -r requirements.txt"
        exit 1
    }
    Write-Warn "No venv found - using system Python: $VenvPy"
} else {
    Write-Ok "Python venv: $VenvPy"
}

# 4. Check Node/npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Warn "npm not found. Install Node.js 22+."
    exit 1
}

# 5. Install web deps if node_modules missing
$WebModules = "$Root\apps\web\node_modules"
if (-not (Test-Path $WebModules)) {
    Write-Step "Installing web dependencies (first run)..."
    Push-Location "$Root\apps\web"
    npm install --silent
    Pop-Location
    Write-Ok "node_modules installed"
}

# 6. Launch API in new terminal
Write-Step "Launching FastAPI (port 8000)..."
$ApiCmd = "& '$VenvPy' -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$Root\apps\api'; $ApiCmd"
)

# 7. Launch Next.js in new terminal
Write-Step "Launching Next.js (port 3000)..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$Root\apps\web'; npm run dev"
)

Start-Sleep -Seconds 1
Write-Host ""
Write-Host "  BuildRadar is starting up:" -ForegroundColor Green
Write-Host "    Web    ->  http://localhost:3000" -ForegroundColor White
Write-Host "    API    ->  http://localhost:8000/docs" -ForegroundColor White
Write-Host "    Health ->  http://localhost:8000/health" -ForegroundColor White
Write-Host ""
Write-Host "  Stop:  .\dev.ps1 stop" -ForegroundColor DarkGray
Write-Host ""
