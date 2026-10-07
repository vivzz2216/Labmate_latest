# LabMate AI - Comprehensive Startup Script
# Run this script to start the entire application

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🚀 LabMate AI Startup Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Docker
Write-Host "[1/8] Checking Docker Desktop..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker Desktop is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Step 2: Check .env file
Write-Host "[2/8] Checking environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path .env)) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file from env.example" -ForegroundColor Red
    exit 1
}
Write-Host "✅ .env file found" -ForegroundColor Green
Write-Host ""

# Step 3: Check for required secrets
Write-Host "[3/8] Validating security configuration..." -ForegroundColor Yellow
$envContent = Get-Content .env -Raw
if ($envContent -match "BETA_KEY=your_beta_key_here" -or $envContent -match "BETA_KEY=CHANGE_ME") {
    Write-Host "⚠️  WARNING: BETA_KEY is not set properly!" -ForegroundColor Yellow
    Write-Host "Generate a new key with:" -ForegroundColor Yellow
    Write-Host "  python -c `"import secrets; print(secrets.token_urlsafe(32))`"" -ForegroundColor Cyan
    Write-Host ""
}
if ($envContent -match "OPENAI_API_KEY=your_openai_api_key_here" -or $envContent -match "OPENAI_API_KEY=$") {
    Write-Host "⚠️  WARNING: OPENAI_API_KEY is not set!" -ForegroundColor Yellow
    Write-Host "AI features will not work without OpenAI API key" -ForegroundColor Yellow
    Write-Host ""
}
Write-Host "✅ Configuration validated" -ForegroundColor Green
Write-Host ""

# Step 4: Stop existing containers
Write-Host "[4/8] Stopping existing containers..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
Write-Host "✅ Existing containers stopped" -ForegroundColor Green
Write-Host ""

# Step 5: Build and start services
Write-Host "[5/8] Building and starting services..." -ForegroundColor Yellow
Write-Host "This may take a few minutes on first run..." -ForegroundColor Cyan
docker-compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start services!" -ForegroundColor Red
    Write-Host "Check logs with: docker-compose logs" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Services started" -ForegroundColor Green
Write-Host ""

# Step 6: Wait for services to be ready
Write-Host "[6/8] Waiting for services to be ready..." -ForegroundColor Yellow
Write-Host "Waiting 20 seconds for services to initialize..." -ForegroundColor Cyan
Start-Sleep -Seconds 20

# Check if backend is ready
$maxRetries = 10
$retryCount = 0
$backendReady = $false

while ($retryCount -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5 2>&1
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    } catch {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Host "  Waiting... (attempt $retryCount/$maxRetries)" -ForegroundColor Gray
            Start-Sleep -Seconds 3
        }
    }
}

if ($backendReady) {
    Write-Host "✅ Backend is ready" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend not responding yet" -ForegroundColor Yellow
    Write-Host "Check logs: docker-compose logs backend" -ForegroundColor Yellow
}
Write-Host ""

# Step 7: Run database migrations
Write-Host "[7/8] Running database migrations..." -ForegroundColor Yellow
Write-Host "Applying security migration..." -ForegroundColor Cyan

# Check if migrations already applied
$migrationCheck = docker-compose exec -T postgres psql -U labmate -d labmate_db -c "\d users" 2>&1
if ($migrationCheck -match "password_hash") {
    Write-Host "✅ Security migration already applied" -ForegroundColor Green
} else {
    Write-Host "Applying new security migration..." -ForegroundColor Cyan
    $migrationResult = Get-Content backend/migrations/005_add_password_security.sql | docker-compose exec -T postgres psql -U labmate -d labmate_db 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Security migration applied successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Migration may have failed, but continuing..." -ForegroundColor Yellow
    }
}
Write-Host ""

# Step 8: Display status and URLs
Write-Host "[8/8] Checking service status..." -ForegroundColor Yellow
Write-Host ""
docker-compose ps
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ LabMate AI is Running!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Access Points:" -ForegroundColor Cyan
Write-Host "  🌐 Frontend:     http://localhost:3000" -ForegroundColor White
Write-Host "  🔌 Backend API:  http://localhost:8000" -ForegroundColor White
Write-Host "  📚 API Docs:     http://localhost:8000/docs" -ForegroundColor White
Write-Host "  ❤️  Health Check: http://localhost:8000/health" -ForegroundColor White
Write-Host ""
Write-Host "📊 Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:       docker-compose logs -f" -ForegroundColor White
Write-Host "  Stop services:   docker-compose down" -ForegroundColor White
Write-Host "  Restart:         docker-compose restart" -ForegroundColor White
Write-Host ""

# Test backend health
Write-Host "🔍 Testing backend health..." -ForegroundColor Cyan
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:8000/health" -UseBasicParsing
    Write-Host "✅ Backend Status: " -NoNewline -ForegroundColor Green
    Write-Host "$($healthResponse.status)" -ForegroundColor White
    
    if ($healthResponse.services) {
        Write-Host "  📦 Database: " -NoNewline -ForegroundColor Cyan
        Write-Host "$($healthResponse.services.database)" -ForegroundColor White
        Write-Host "  🔴 Redis: " -NoNewline -ForegroundColor Cyan
        Write-Host "$($healthResponse.services.redis)" -ForegroundColor White
    }
} catch {
    Write-Host "⚠️  Could not reach backend health endpoint" -ForegroundColor Yellow
    Write-Host "The service may still be starting up" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open browser: http://localhost:3000" -ForegroundColor White
Write-Host "2. Create an account (use strong password!)" -ForegroundColor White
Write-Host "3. Upload a DOCX/PDF file" -ForegroundColor White
Write-Host "4. Try the AI features" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Security Note:" -ForegroundColor Yellow
Write-Host "Make sure to:" -ForegroundColor White
Write-Host "  • Set unique BETA_KEY in .env" -ForegroundColor White
Write-Host "  • Set SECRET_KEY in .env" -ForegroundColor White
Write-Host "  • Add your OPENAI_API_KEY for AI features" -ForegroundColor White
Write-Host "  • Review SECURITY_AUDIT_REPORT.md" -ForegroundColor White
Write-Host ""

# Open browser automatically
$openBrowser = Read-Host "Would you like to open the app in your browser? (Y/n)"
if ($openBrowser -eq "" -or $openBrowser -eq "Y" -or $openBrowser -eq "y") {
    Write-Host "Opening browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000"
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:8000/docs"
}

Write-Host ""
Write-Host "Press any key to view logs (or Ctrl+C to exit)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
docker-compose logs -f

