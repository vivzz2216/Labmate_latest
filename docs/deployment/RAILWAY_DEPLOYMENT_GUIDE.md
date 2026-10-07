# Railway Deployment Guide for LabMate

## 🚨 **Current Issue: Database Connection Error**

Your deployment is failing because the `DATABASE_URL` is pointing to `postgres` (the Docker Compose service name) instead of Railway's PostgreSQL instance.

**Error:** `psycopg2.OperationalError: could not translate host name "postgres" to address: Name or service not known`

---

## ✅ **Complete Fix - Step by Step**

### **Step 1: Add PostgreSQL Database in Railway**

1. Go to your Railway project dashboard
2. Click **"+ New"** button
3. Select **"Database"**
4. Choose **"Add PostgreSQL"**
5. Railway will automatically:
   - Create a PostgreSQL instance
   - Generate a `DATABASE_URL` environment variable
   - Link it to your service

### **Step 2: Configure Environment Variables**

Go to your service **Settings** → **Variables** and add/verify these:

#### **Required Variables:**

```bash
# Database (Railway provides this automatically when you add PostgreSQL)
DATABASE_URL=<Railway will auto-populate this>

# Security
BETA_KEY=your_secure_random_key_here

# OpenAI Configuration
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=4000

# File Paths (Railway compatible)
UPLOAD_DIR=/app/uploads
SCREENSHOT_DIR=/app/screenshots
REPORT_DIR=/app/reports
REACT_TEMP_DIR=/app/react_temp
```

#### **Optional Variables (Firebase):**

```bash
FIREBASE_PROJECT_ID=labma-24543
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\nYOUR_KEY_HERE\\n-----END PRIVATE KEY-----
```

### **Step 3: Verify Railway Configuration**

#### **Check your `railway.json` (if present):**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "bash start.sh",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### **Check your `start.sh`:**

```bash
#!/bin/bash

# Get PORT from Railway (defaults to 8000 if not set)
export PORT=${PORT:-8000}

echo "Environment variables:"
echo "PORT: $PORT"
echo "DATABASE_URL: ${DATABASE_URL:0:30}..."

echo "Using PORT from environment: $PORT"
echo "Starting LabMate API on port $PORT"

# Start the application
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### **Step 4: Push Changes and Redeploy**

```bash
# Commit the updated main.py
git add backend/app/main.py
git commit -m "Fix database connection error handling for Railway"
git push origin main
```

Railway will automatically detect the push and redeploy.

---

## 🔍 **Troubleshooting**

### **Issue: Still seeing database connection error**

**Check:**
1. PostgreSQL service is running in Railway
2. `DATABASE_URL` is correctly set (Railway auto-provides this)
3. The DATABASE_URL format is: `postgresql://user:password@host:port/database`

### **Issue: Application starts but crashes**

**Check Railway logs for:**
- Missing environment variables
- Port binding issues
- Memory/resource constraints

### **Issue: Health check failing**

**Verify:**
1. Your `/health` endpoint returns 200 OK
2. Health check timeout is sufficient (100s recommended)
3. Application is listening on `0.0.0.0:$PORT`

---

## ✅ **Success Checklist**

- [ ] PostgreSQL database added in Railway
- [ ] `DATABASE_URL` auto-populated by Railway
- [ ] All required environment variables set
- [ ] Code changes committed and pushed
- [ ] Railway deployment successful
- [ ] Health check passing
- [ ] Application accessible at `https://labmate-production.up.railway.app`

---

## 🚀 **Expected Deployment Flow**

1. **Build Phase:** Railway builds your Docker image
2. **Deploy Phase:** Container starts, runs `start.sh`
3. **Database Init:** App connects to PostgreSQL and creates tables
4. **Health Check:** Railway pings `/health` endpoint
5. **Success:** Application is live!

---

## 📝 **Important Notes**

- **Docker-in-Docker won't work on Railway** - Code execution features that require Docker will not function
- **Persistent storage is ephemeral** - Uploaded files will be lost on redeploy (use Railway volumes or external storage)
- **Environment variables are the source of truth** - Never hardcode credentials

---

## 🆘 **Need Help?**

If you're still having issues:

1. Check Railway logs: **Deployments** → Click on deployment → **Deploy Logs**
2. Verify environment variables: **Settings** → **Variables**
3. Check database status: Click on PostgreSQL service
4. Test locally with Railway's DATABASE_URL: Copy the connection string and test locally

---

**Last Updated:** October 22, 2025
**Status:** ✅ Ready for Railway Deployment

