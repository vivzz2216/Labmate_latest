# Docker Desktop Start Guide

## Issue: Docker Desktop Not Running

The error `unable to get image` and `The system cannot find the file specified` means Docker Desktop is not running.

## Solution Steps

### Step 1: Start Docker Desktop

1. **Open Docker Desktop Application**
   - Press `Windows Key` and type "Docker Desktop"
   - Click on "Docker Desktop" application
   - OR find it in your Start Menu

2. **Wait for Docker to Start**
   - You'll see a Docker whale icon in your system tray (bottom right)
   - Wait until the icon stops animating (usually 30-60 seconds)
   - The icon should be solid/steady when ready

3. **Verify Docker is Running**
   - Right-click the Docker icon in system tray
   - It should show "Docker Desktop is running"
   - If it says "Start Docker Desktop", click it

### Step 2: Verify Docker is Ready

Open PowerShell and run:

```powershell
# Check Docker version (should work if Docker is running)
docker version

# Check if Docker daemon is accessible
docker ps
```

**Expected Output:**
- `docker version` should show both Client and Server versions
- `docker ps` should show an empty list (no error)

**If you get errors:**
- Docker Desktop is still starting - wait 30 more seconds
- Docker Desktop needs to be restarted - close and reopen it

### Step 3: Once Docker is Running

Then run your project:

```powershell
cd C:\Users\pilla\OneDrive\Desktop\Labmate
docker-compose up -d --build
```

## Alternative: Check Docker Status

### Method 1: System Tray
- Look for Docker whale icon in system tray
- Hover over it to see status
- Right-click for options

### Method 2: Task Manager
1. Press `Ctrl + Shift + Esc` to open Task Manager
2. Look for "Docker Desktop" process
3. If not found, Docker is not running

### Method 3: PowerShell Check
```powershell
# Check if Docker Desktop process is running
Get-Process "Docker Desktop" -ErrorAction SilentlyContinue

# Check Docker service
Get-Service -Name "*docker*" -ErrorAction SilentlyContinue
```

## Common Issues

### Issue 1: Docker Desktop Won't Start
**Solution:**
1. Restart your computer
2. Run Docker Desktop as Administrator
3. Check Windows updates
4. Reinstall Docker Desktop if needed

### Issue 2: Docker Desktop Starts But Commands Don't Work
**Solution:**
1. Wait 1-2 minutes after Docker Desktop starts
2. Restart Docker Desktop
3. Check if WSL 2 is properly configured (Docker Desktop requires WSL 2)

### Issue 3: "WSL 2 installation is incomplete"
**Solution:**
1. Docker Desktop will show a notification
2. Click the link to install WSL 2
3. Follow the installation instructions
4. Restart Docker Desktop after WSL 2 installation

## Quick Verification Script

Run this in PowerShell to check everything:

```powershell
Write-Host "Checking Docker Desktop..." -ForegroundColor Yellow

# Check if Docker Desktop process is running
$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if ($dockerProcess) {
    Write-Host "✓ Docker Desktop process is running" -ForegroundColor Green
} else {
    Write-Host "✗ Docker Desktop process NOT found" -ForegroundColor Red
    Write-Host "  Please start Docker Desktop application" -ForegroundColor Yellow
    exit
}

# Check Docker version
Write-Host "`nChecking Docker connection..." -ForegroundColor Yellow
try {
    $dockerVersion = docker version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker is accessible" -ForegroundColor Green
    } else {
        Write-Host "✗ Docker is not accessible" -ForegroundColor Red
        Write-Host "  Wait a bit longer for Docker to fully start" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Docker connection failed" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

# Check docker ps
Write-Host "`nTesting Docker commands..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker commands are working" -ForegroundColor Green
        Write-Host "`nYou can now run: docker-compose up -d --build" -ForegroundColor Cyan
    }
} catch {
    Write-Host "✗ Docker commands not working yet" -ForegroundColor Red
}
```

## After Docker is Running

Once Docker Desktop is confirmed running, you can proceed:

```powershell
# Navigate to project
cd C:\Users\pilla\OneDrive\Desktop\Labmate

# Start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

---

**Remember:** Docker Desktop must be running before you can use `docker` or `docker-compose` commands!

