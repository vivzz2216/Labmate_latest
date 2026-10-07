# 🚂 Railway Deployment Guide - LabMate AI

## ✅ Is Railway a Good Choice? **YES, with Considerations**

### ✅ **Why Railway is Good for Your Project:**

1. **Perfect for FastAPI/Next.js** - Native support for Python and Node.js
2. **PostgreSQL Built-in** - Easy database setup with one click
3. **Docker Support** - Your Dockerfile will work seamlessly
4. **GitHub Integration** - Automatic deployments on push
5. **Free Tier Available** - $5 credit/month, good for testing
6. **Easy Environment Variables** - Simple configuration
7. **Health Checks** - Built-in monitoring
8. **Auto-scaling** - Handles traffic spikes
9. **HTTPS by Default** - SSL certificates included
10. **Good Documentation** - Well-documented platform

### ⚠️ **Important Limitations:**

1. **Docker-in-Docker Won't Work** ⚠️
   - Your code execution features (Docker containers) **will NOT work** on Railway
   - Railway containers don't have access to Docker daemon
   - **Workaround**: Use Railway's Docker service or external Docker API

2. **Ephemeral Storage** ⚠️
   - Files uploaded to `/app/uploads` will be **lost on redeploy**
   - **Solution**: Use Railway Volumes or external storage (S3, Cloudflare R2)

3. **Resource Limits** ⚠️
   - Free tier has memory/CPU limits
   - May need to upgrade for heavy workloads

---

## 🚀 Complete Deployment Steps

### **Step 1: Prepare Your Repository**

1. **Push code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Prepare for Railway deployment"
   git push origin main
   ```

2. **Verify these files exist**:
   - ✅ `railway.json` (already exists)
   - ✅ `backend/Dockerfile` (already exists)
   - ✅ `backend/app/main.py` (with health check)

---

### **Step 2: Create Railway Account & Project**

1. **Sign up at Railway**: https://railway.app
   - Use GitHub OAuth (recommended)

2. **Create New Project**:
   - Click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Choose your `labmate-clean` repository
   - Select branch: `main` (or your deployment branch)

3. **Railway will automatically**:
   - Detect your `railway.json`
   - Start building from `backend/Dockerfile`
   - Create a service

---

### **Step 3: Add PostgreSQL Database**

1. **In Railway Dashboard**:
   - Click **"+ New"** button (top right)
   - Select **"Database"**
   - Choose **"Add PostgreSQL"**

2. **Railway automatically**:
   - Creates PostgreSQL instance
   - Generates `DATABASE_URL` environment variable
   - Links it to your service

3. **Verify**:
   - Go to your service → **Variables** tab
   - You should see `DATABASE_URL` auto-populated

---

### **Step 4: Configure Environment Variables**

Go to your service → **Settings** → **Variables** and add:

#### **🔴 Required Variables:**

```bash
# Database (Auto-provided by Railway PostgreSQL)
DATABASE_URL=<Railway auto-populates this>

# Security Keys (Generate these!)
BETA_KEY=<generate with: openssl rand -hex 32>
SECRET_KEY=<generate with: openssl rand -hex 32>

# OpenAI (Required for AI features)
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=4000

# File Directories (Railway compatible paths)
UPLOAD_DIR=/app/uploads
SCREENSHOT_DIR=/app/screenshots
REPORT_DIR=/app/reports
REACT_TEMP_DIR=/app/react_temp

# CORS (Important for production!)
ALLOWED_ORIGINS=https://your-frontend-domain.railway.app,https://your-custom-domain.com

# Rate Limiting (Recommended for production)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60
```

#### **🟡 Optional Variables:**

```bash
# Redis (Optional - for caching/CSRF tokens)
REDIS_URL=<Railway Redis URL if you add Redis plugin>

# Frontend URL (If deploying frontend separately)
NEXT_PUBLIC_API_URL=https://your-backend.railway.app

# Firebase (If using Firebase features)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key
```

#### **🔧 How to Generate Keys:**

```bash
# Generate BETA_KEY
openssl rand -hex 32

# Generate SECRET_KEY
openssl rand -hex 32

# Or use Python:
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

### **Step 5: Add Persistent Storage (IMPORTANT!)**

**Problem**: Files will be lost on redeploy without volumes.

**Solution**: Add Railway Volumes

1. **In Railway Dashboard**:
   - Go to your service
   - Click **"Settings"** tab
   - Scroll to **"Volumes"** section
   - Click **"Add Volume"**

2. **Add these volumes**:
   ```
   /app/uploads → uploads
   /app/screenshots → screenshots
   /app/reports → reports
   /app/react_temp → react_temp
   ```

3. **This ensures**:
   - Files persist across redeployments
   - Data is not lost

---

### **Step 6: Configure Build Settings**

1. **Verify Build Settings**:
   - Go to service → **Settings** → **Build**
   - **Dockerfile Path**: Should be `backend/Dockerfile`
   - **Root Directory**: Leave empty (or set to `backend/`)

2. **Verify Deploy Settings**:
   - **Health Check Path**: `/health`
   - **Health Check Timeout**: `100` seconds
   - **Restart Policy**: `ON_FAILURE`

---

### **Step 7: Deploy Frontend (Optional - Separate Service)**

If you want to deploy frontend separately:

1. **Create New Service**:
   - Click **"+ New"** → **"GitHub Repo"**
   - Select same repository
   - Choose **"frontend"** directory

2. **Configure Frontend**:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start` (or use `serve`)

3. **Environment Variables**:
   ```bash
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```

---

### **Step 8: Run Database Migrations**

After first deployment:

1. **Connect to Railway PostgreSQL**:
   - Go to PostgreSQL service
   - Click **"Connect"** tab
   - Copy connection string

2. **Run migrations**:
   ```bash
   # Option 1: Via Railway CLI
   railway run python -m alembic upgrade head
   
   # Option 2: Via Railway Shell
   railway shell
   python -m alembic upgrade head
   
   # Option 3: Manual SQL (if no Alembic)
   # Copy SQL from backend/migrations/*.sql
   # Execute via Railway PostgreSQL dashboard
   ```

---

### **Step 9: Verify Deployment**

1. **Check Deployment Status**:
   - Go to **"Deployments"** tab
   - Wait for build to complete (green checkmark)

2. **Check Logs**:
   - Click on latest deployment
   - View **"Deploy Logs"**
   - Look for: "Application startup complete"

3. **Test Health Check**:
   ```bash
   curl https://your-app.railway.app/health
   # Should return: {"status": "healthy", ...}
   ```

4. **Test API Docs**:
   - Visit: `https://your-app.railway.app/docs`
   - Should show FastAPI Swagger UI

---

### **Step 10: Set Up Custom Domain (Optional)**

1. **In Railway Dashboard**:
   - Go to service → **Settings** → **Networking**
   - Click **"Generate Domain"** (or add custom domain)
   - Railway provides: `your-app.up.railway.app`

2. **For Custom Domain**:
   - Add your domain
   - Update DNS records as instructed
   - Railway handles SSL automatically

---

## 🔧 Railway-Specific Configuration

### **Update railway.json** (if needed):

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### **Verify backend/Dockerfile**:

Your Dockerfile should use `PORT` environment variable:
```dockerfile
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

✅ **Already correct in your Dockerfile!**

---

## ⚠️ Important Limitations & Workarounds

### **1. Docker-in-Docker Won't Work**

**Problem**: Code execution features require Docker daemon access.

**Solutions**:

**Option A: Disable Code Execution** (Simplest)
- Remove or disable code execution endpoints
- Focus on document parsing and AI features only

**Option B: Use External Docker API**
- Deploy Docker daemon on separate service (e.g., DigitalOcean Droplet)
- Connect via Docker API
- Update `executor_service.py` to use remote Docker

**Option C: Use Railway's Docker Service** (If available)
- Check Railway's Docker plugin availability
- May require paid plan

### **2. Ephemeral Storage**

**Problem**: Files lost on redeploy.

**Solution**: Use Railway Volumes (see Step 5)

**Alternative**: Use External Storage
- AWS S3
- Cloudflare R2 (cheaper)
- Google Cloud Storage
- Update code to use external storage

### **3. Resource Limits**

**Free Tier Limits**:
- 512MB RAM
- 1GB storage
- $5 credit/month

**If you hit limits**:
- Upgrade to Hobby plan ($5/month)
- Or use Railway's usage-based pricing

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] Code pushed to GitHub
- [ ] `railway.json` exists and is correct
- [ ] `backend/Dockerfile` uses `${PORT:-8000}`
- [ ] Health check endpoint `/health` works
- [ ] All environment variables documented
- [ ] Database migrations ready
- [ ] Secrets generated (BETA_KEY, SECRET_KEY)
- [ ] OpenAI API key obtained
- [ ] CORS configured for production domain
- [ ] Rate limiting enabled for production

---

## 🚨 Post-Deployment Checklist

After deployment, verify:

- [ ] Health check returns 200 OK
- [ ] API docs accessible at `/docs`
- [ ] Database connection working
- [ ] Environment variables set correctly
- [ ] Volumes mounted (if using persistent storage)
- [ ] Logs show no errors
- [ ] Can create user account
- [ ] Can upload file
- [ ] Can parse document
- [ ] AI features work (if OpenAI key set)

---

## 🔍 Troubleshooting

### **Issue: Build Fails**

**Check**:
1. Railway logs for error messages
2. Dockerfile syntax
3. Requirements.txt dependencies
4. Build timeout (increase if needed)

### **Issue: Application Crashes on Start**

**Check**:
1. Environment variables (all required vars set?)
2. Database connection (DATABASE_URL correct?)
3. Port binding (using `${PORT:-8000}`?)
4. Memory limits (may need more RAM)

### **Issue: Database Connection Error**

**Check**:
1. PostgreSQL service running
2. `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
3. Database accessible from service
4. Network policies (should be auto-configured)

### **Issue: Files Disappear After Redeploy**

**Solution**: Add Railway Volumes (see Step 5)

### **Issue: Health Check Failing**

**Check**:
1. `/health` endpoint returns 200
2. Health check timeout sufficient (100s)
3. Application listening on `0.0.0.0:$PORT`

---

## 💰 Cost Estimation

### **Free Tier**:
- $5 credit/month
- Good for: Testing, low traffic
- **Estimated cost**: $0-5/month

### **Hobby Plan** ($5/month):
- More resources
- Better for: Small production apps
- **Estimated cost**: $5-20/month

### **Pro Plan** (Usage-based):
- Pay for what you use
- Better for: Production apps
- **Estimated cost**: $20-100/month (depending on usage)

---

## 🎯 Recommended Architecture

### **Option 1: Backend Only on Railway** (Recommended for Start)

```
Railway:
├── Backend Service (FastAPI)
├── PostgreSQL Database
└── Redis (optional)

Frontend:
└── Deploy separately (Vercel, Netlify, or Railway)
```

### **Option 2: Full Stack on Railway**

```
Railway:
├── Backend Service (FastAPI)
├── Frontend Service (Next.js)
├── PostgreSQL Database
└── Redis (optional)
```

---

## 📚 Additional Resources

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Your Project Docs**: `docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md`

---

## ✅ Summary

**Railway is an EXCELLENT choice for your project because**:
- ✅ Easy setup and deployment
- ✅ PostgreSQL included
- ✅ Docker support
- ✅ GitHub integration
- ✅ Free tier available
- ✅ Good for FastAPI/Next.js

**But remember**:
- ⚠️ Docker-in-Docker won't work (code execution disabled)
- ⚠️ Need volumes for persistent storage
- ⚠️ May need to upgrade for production scale

**Next Steps**:
1. Follow Step 1-10 above
2. Test thoroughly
3. Monitor costs
4. Scale as needed

---

**Ready to deploy? Start with Step 1!** 🚀

*Last Updated: January 2025*



