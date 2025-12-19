# 🚀 Complete Setup & Run Guide - LabMate AI

## ⚠️ IMPORTANT: Security Updates Applied

**Before running, you MUST complete these security steps!**

---

## 📋 Prerequisites

### Required Software
- ✅ **Docker Desktop** - Must be running
- ✅ **Git** - For cloning (if needed)
- ✅ **PowerShell/Terminal** - For running commands

### Required API Keys
- 🔑 **OpenAI API Key** (for AI features)
- 🔑 **Redis URL** (already configured)
- 🔑 **Beta Key** (generate new one)
- 🔑 **Secret Key** (generate new one)

---

## 🔒 Step 1: Security Setup (CRITICAL)

### 1.1 Generate New Security Keys

Open PowerShell and run:

```powershell
# Generate BETA_KEY
python -c "import secrets; print('BETA_KEY=' + secrets.token_urlsafe(32))"

# Generate SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
```

**Save these keys!** You'll need them in Step 1.3.

### 1.2 Rotate Exposed TestSprite API Key

⚠️ **CRITICAL:** Your TestSprite API key was found exposed in version control!

```
Exposed Key: REDACTED
```

**Actions:**
1. Go to https://testsprite.com/dashboard/api-keys
2. Revoke the old key
3. Generate a new key
4. Update `.cursor/mcp.json` with new key
5. Add `.cursor/mcp.json` to `.gitignore`

### 1.3 Create/Update `.env` File

Create a `.env` file in the project root with these settings:

```bash
# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
POSTGRES_USER=labmate
POSTGRES_PASSWORD=labmate_password
POSTGRES_DB=labmate_db
DATABASE_URL=postgresql://labmate:labmate_password@postgres:5432/labmate_db

# =============================================================================
# SECURITY CONFIGURATION (CHANGE THESE!)
# =============================================================================
# Use the keys you generated in Step 1.1
BETA_KEY=YOUR_GENERATED_BETA_KEY_HERE
SECRET_KEY=YOUR_GENERATED_SECRET_KEY_HERE

# Allowed CORS origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================
REDIS_URL=redis://default:hkIdOTA6qPbssm2aHVzjEjr7Ml1jPTi1@redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706
REDIS_CACHE_TTL=3600

# =============================================================================
# OPENAI CONFIGURATION
# =============================================================================
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=4000

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60

# =============================================================================
# FILE STORAGE
# =============================================================================
UPLOAD_DIR=/app/uploads
SCREENSHOT_DIR=/app/screenshots
REPORT_DIR=/app/reports
REACT_TEMP_DIR=/app/react_temp

# =============================================================================
# DOCKER SETTINGS
# =============================================================================
HOST_PROJECT_ROOT=${PWD}
```

### 1.4 Update docker-compose.yml

Replace the hardcoded `BETA_KEY` in `docker-compose.yml`:

```yaml
# BEFORE (Line 56)
- BETA_KEY=your_beta_key_here

# AFTER
- BETA_KEY=${BETA_KEY}
- SECRET_KEY=${SECRET_KEY}
- ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-http://localhost:3000}
```

---

## 🗄️ Step 2: Database Migration

### 2.1 First-Time Setup

If this is your first time running the project, the database will be created automatically. After starting services (Step 3), you need to run the security migration.

### 2.2 Run Security Migration

After services are up (Step 3), run:

```powershell
# Run the password security migration
docker-compose exec -T postgres psql -U labmate -d labmate_db < backend/migrations/005_add_password_security.sql

# Run performance indexes migration
docker-compose exec -T postgres psql -U labmate -d labmate_db < backend/migrations/004_add_performance_indexes.sql
```

Or run them individually:

```powershell
# Add password security fields
docker-compose exec postgres psql -U labmate -d labmate_db -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
"

# Add unique constraint on email
docker-compose exec postgres psql -U labmate -d labmate_db -c "
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
"
```

---

## 🐳 Step 3: Start Docker Services

### 3.1 Ensure Docker Desktop is Running

1. Open **Docker Desktop** application
2. Wait for the whale icon to appear in system tray
3. Verify it says "Docker Desktop is running"

### 3.2 Build and Start Services

```powershell
# Navigate to project directory
cd C:\Users\pilla\OneDrive\Desktop\Labmate

# Build and start all services
docker-compose up -d --build
```

**This will start:**
- 🐘 PostgreSQL database (port 5432)
- 🐍 FastAPI backend (port 8000)
- ⚛️ Next.js frontend (port 3000)

### 3.3 Wait for Services to Start

```powershell
# Check status (wait until all show "Up")
docker-compose ps

# Watch logs
docker-compose logs -f
```

**Expected output:**
```
✓ Database tables created successfully
✓ Redis connection established
✓ FastAPI running on port 8000
✓ Next.js ready on port 3000
```

---

## ✅ Step 4: Verify Installation

### 4.1 Check Backend Health

```powershell
curl http://localhost:8000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "message": "LabMate API is running",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  },
  "metrics": {
    "total_requests": 0,
    "avg_response_time": "0.000s",
    "error_rate": "0.00%"
  }
}
```

### 4.2 Check API Documentation

Open browser: http://localhost:8000/docs

You should see the FastAPI Swagger documentation.

### 4.3 Check Frontend

Open browser: http://localhost:3000

You should see the LabMate homepage.

### 4.4 Test Authentication (New Security Features)

**Test 1: Signup with Weak Password (Should Fail)**
```powershell
curl -X POST http://localhost:8000/api/basic-auth/signup `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"name\":\"Test User\",\"password\":\"weak\"}'
```

**Expected:** 422 Error with password validation messages ✅

**Test 2: Signup with Strong Password (Should Succeed)**
```powershell
curl -X POST http://localhost:8000/api/basic-auth/signup `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"name\":\"Test User\",\"password\":\"SecureP@ssw0rd123\"}'
```

**Expected:** 200 OK with user data ✅

**Test 3: Login with Correct Password**
```powershell
curl -X POST http://localhost:8000/api/basic-auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"password\":\"SecureP@ssw0rd123\"}'
```

**Expected:** 200 OK with user data ✅

**Test 4: Brute Force Protection (6 Failed Attempts)**
```powershell
# Run 6 times
for ($i=1; $i -le 6; $i++) {
    Write-Host "Attempt $i"
    curl -X POST http://localhost:8000/api/basic-auth/login `
      -H "Content-Type: application/json" `
      -d '{\"email\":\"test@example.com\",\"password\":\"wrong\"}'
}
```

**Expected:** 
- Attempts 1-5: 401 Unauthorized
- Attempt 6: 423 Locked (account locked for 15 minutes) ✅

---

## 📊 Step 5: Access Points

### 🌐 Application URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Main application |
| **Backend API** | http://localhost:8000 | REST API |
| **API Docs** | http://localhost:8000/docs | Swagger documentation |
| **Health Check** | http://localhost:8000/health | Service health status |
| **Database** | localhost:5432 | PostgreSQL (from host) |

### 🔑 Default Credentials (Development)

**Database:**
- Host: localhost
- Port: 5432
- User: labmate
- Password: labmate_password
- Database: labmate_db

---

## 🛠️ Common Commands

### View Logs
```powershell
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Last 50 lines
docker-compose logs --tail=50
```

### Stop Services
```powershell
# Stop all
docker-compose down

# Stop and remove volumes (clean start)
docker-compose down -v
```

### Restart Services
```powershell
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Rebuild Services
```powershell
# Rebuild and restart
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

### Check Service Status
```powershell
docker-compose ps
```

### Monitor Resource Usage
```powershell
docker stats
```

### Access Service Shell
```powershell
# Backend shell
docker-compose exec backend bash

# Database shell
docker-compose exec postgres psql -U labmate -d labmate_db
```

---

## 🐛 Troubleshooting

### Issue 1: Docker Desktop Not Running

**Error:** `error during connect: This error may indicate that the docker daemon is not running`

**Solution:**
1. Open Docker Desktop
2. Wait for "Docker Desktop is running"
3. Try again

### Issue 2: Port Already in Use

**Error:** `Bind for 0.0.0.0:8000 failed: port is already allocated`

**Solution:**
```powershell
# Find process using port
netstat -ano | findstr :8000

# Kill process (replace PID with actual number)
taskkill /PID [PID] /F

# Or stop Docker services
docker-compose down
```

### Issue 3: Database Connection Failed

**Error:** `could not connect to server: Connection refused`

**Solution:**
```powershell
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Issue 4: Redis Connection Failed

**Error:** `⚠ Redis not available`

**Solution:**
1. Check `REDIS_URL` in `.env` file
2. Test connection: `curl http://localhost:8000/health`
3. Verify Redis Labs instance is active
4. Check network connectivity

### Issue 5: Frontend Can't Connect to Backend

**Error:** `Network Error` or CORS errors in browser console

**Solution:**
1. Check `ALLOWED_ORIGINS` in `.env` includes your frontend URL
2. Restart backend: `docker-compose restart backend`
3. Clear browser cache
4. Check backend logs: `docker-compose logs backend`

### Issue 6: Permission Denied (Windows)

**Error:** `Permission denied` when accessing files

**Solution:**
1. Run PowerShell as Administrator
2. Or adjust Docker Desktop file sharing settings
3. Settings → Resources → File Sharing → Add project directory

---

## 🧪 Testing the Application

### Manual Testing Checklist

- [ ] ✅ Backend health check returns 200
- [ ] ✅ Frontend loads at localhost:3000
- [ ] ✅ API docs accessible
- [ ] ✅ Can create user account (signup)
- [ ] ✅ Weak passwords rejected
- [ ] ✅ Strong passwords accepted
- [ ] ✅ Can login with correct password
- [ ] ✅ Wrong passwords rejected
- [ ] ✅ Account locks after 5 failed attempts
- [ ] ✅ Can upload DOCX/PDF files
- [ ] ✅ Invalid file types rejected
- [ ] ✅ Can parse uploaded files
- [ ] ✅ Can execute code
- [ ] ✅ Can generate reports

### Security Testing

Run the verification script:

```powershell
# Test authentication security
.\test_security.ps1
```

Or manually test each security feature as shown in Step 4.4.

---

## 📈 Monitoring & Performance

### Check Application Health

```powershell
# Health endpoint
curl http://localhost:8000/health

# Metrics endpoint
curl http://localhost:8000/api/health
```

### Monitor Database

```powershell
# Connect to database
docker-compose exec postgres psql -U labmate -d labmate_db

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check database size
SELECT pg_size_pretty(pg_database_size('labmate_db'));
```

### Monitor Docker Resources

```powershell
# Real-time stats
docker stats

# Container details
docker-compose ps -a
```

---

## 🔄 Development Workflow

### Making Code Changes

**Backend changes:**
```powershell
# Code changes are auto-reloaded (--reload flag)
# Just edit files and save
# Check logs: docker-compose logs -f backend
```

**Frontend changes:**
```powershell
# Rebuild frontend
docker-compose up -d --build frontend

# Or restart with cache clear
docker-compose restart frontend
```

**Database schema changes:**
```powershell
# Create new migration file
# backend/migrations/006_your_change.sql

# Apply migration
docker-compose exec -T postgres psql -U labmate -d labmate_db < backend/migrations/006_your_change.sql
```

---

## 🎯 Next Steps After Setup

1. **Configure OpenAI API Key** (if not done)
   - Get key from: https://platform.openai.com/api-keys
   - Add to `.env` file
   - Restart backend

2. **Test AI Features**
   - Upload a document
   - Try AI analysis
   - Generate code suggestions

3. **Explore API Documentation**
   - Visit http://localhost:8000/docs
   - Test endpoints
   - Review authentication flow

4. **Review Security Documentation**
   - Read `SECURITY_AUDIT_REPORT.md`
   - Review `DEPLOYMENT_SECURITY_CHECKLIST.md`
   - Understand `FRONTEND_SECURITY_GUIDE.md`

---

## 📞 Need Help?

### Documentation Files
- **Security:** `SECURITY_AUDIT_REPORT.md`
- **Testing:** `TESTING_PLAN.md`
- **Deployment:** `DEPLOYMENT_SECURITY_CHECKLIST.md`
- **Frontend:** `FRONTEND_SECURITY_GUIDE.md`
- **Summary:** `REVIEW_SUMMARY.md`

### Check Logs
```powershell
docker-compose logs -f
```

### Common Issues
Most issues are resolved by:
1. Ensuring Docker Desktop is running
2. Checking `.env` file is configured
3. Running database migrations
4. Restarting services: `docker-compose restart`

---

## ✅ Success Checklist

Before considering setup complete:

- [ ] Docker Desktop installed and running
- [ ] `.env` file created with all required keys
- [ ] New BETA_KEY and SECRET_KEY generated
- [ ] TestSprite API key rotated
- [ ] Services started: `docker-compose up -d --build`
- [ ] Database migrations run
- [ ] Health check returns "healthy"
- [ ] Frontend loads at localhost:3000
- [ ] Backend API accessible at localhost:8000
- [ ] Authentication tests passing
- [ ] File upload working
- [ ] All security features verified

---

**Status: Ready to Run! 🚀**

Run: `docker-compose up -d --build` to start the application.

