# LabMate AI - Access URLs

## ✅ Correct URLs to Access

### 🌐 Web Application (Frontend)
**URL:** http://localhost:3000

This is your main web application interface. Open this in your browser to use LabMate AI.

### 🔧 Backend API
**URL:** http://localhost:8000

**API Documentation:** http://localhost:8000/docs

**Health Check:** http://localhost:8000/health

**API Root:** http://localhost:8000/api/

### 🗄️ Database (PostgreSQL)
**Port:** 5432

**⚠️ Important:** Port 5432 is NOT a web server! You cannot access it via a browser.

**To connect to the database, use:**
- **Host:** localhost
- **Port:** 5432
- **Database:** labmate_db
- **Username:** labmate
- **Password:** labmate_password

**Connection String:**
```
postgresql://labmate:labmate_password@localhost:5432/labmate_db
```

**Tools to connect:**
- pgAdmin (GUI)
- DBeaver (GUI)
- psql (command line)
- Any PostgreSQL client

**Command line connection:**
```bash
docker-compose exec postgres psql -U labmate -d labmate_db
```

## 🚫 What NOT to Access

- ❌ **http://localhost:5432/** - This won't work! PostgreSQL is a database, not a web server
- ❌ **http://localhost:5432** - Same as above

## ✅ Quick Access Guide

1. **Open your web browser**
2. **Go to:** http://localhost:3000
3. **You should see the LabMate AI landing page**

## 🔍 Verify Services

Check if all services are running:
```powershell
docker-compose ps
```

You should see:
- ✅ `labmate-frontend-1` - Running on port 3000
- ✅ `labmate-backend-1` - Running on port 8000
- ✅ `labmate-postgres-1` - Running on port 5432 (healthy)

## 📝 Summary

| Service | URL/Port | Purpose | Access Method |
|---------|----------|---------|---------------|
| Frontend | http://localhost:3000 | Web UI | Browser |
| Backend API | http://localhost:8000 | REST API | Browser/HTTP Client |
| API Docs | http://localhost:8000/docs | API Documentation | Browser |
| PostgreSQL | localhost:5432 | Database | Database Client |

---

**Remember:** Port 5432 is for database connections, not web browsing!


