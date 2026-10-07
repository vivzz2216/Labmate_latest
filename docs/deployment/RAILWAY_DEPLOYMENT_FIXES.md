# Railway Deployment - Configuration Fixes

This document summarizes the **minimum required changes** made to deploy LabMate successfully on Railway.app without errors.

## ✅ Changes Made

### 1. Frontend Dockerfile - PORT Configuration
**File:** `frontend/Dockerfile`
- **Changed:** Hardcoded port 3000 → Dynamic PORT environment variable
- **Before:** `CMD ["serve", "-s", "out", "-l", "3000", "--no-clipboard"]`
- **After:** `CMD ["sh", "-c", "serve -s out -l ${PORT:-3000} --no-clipboard"]`
- **Why:** Railway sets PORT dynamically, must use `process.env.PORT`

### 2. Frontend - Hardcoded localhost URLs Fixed
**Files:** 
- `frontend/app/dashboard/page.tsx`
- `frontend/app/preview/page.tsx`

- **Changed:** Hardcoded `http://localhost:8000` → Environment variable
- **Before:** `src={`http://localhost:8000${result.screenshot_url}`}`
- **After:** `src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${result.screenshot_url}`}`
- **Why:** Frontend must use Railway backend URL, not localhost

### 3. Frontend package.json - Node Version
**File:** `frontend/package.json`
- **Added:** `engines` field specifying Node.js version
- **Added:**
  ```json
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  }
  ```
- **Why:** Railway needs to know which Node version to use

### 4. Backend Dockerfile - Already Correct ✅
**File:** `backend/Dockerfile`
- **Status:** Already configured correctly
- **Current:** `CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]`
- **Why:** Already uses PORT env var and binds to 0.0.0.0

### 5. Environment Variables Documentation
**File:** `env.example`
- **Added:** Railway-specific deployment notes
- **Added:** Clear documentation of required vs optional variables
- **Why:** Helps users configure Railway correctly

## ✅ Railway Requirements Checklist

- [x] **PORT Configuration** - Backend and frontend use `process.env.PORT`
- [x] **Host Binding** - Backend binds to `0.0.0.0` (not localhost)
- [x] **Start Command** - Dockerfile CMD uses PORT env var
- [x] **Node Version** - Frontend package.json specifies engines
- [x] **No Hardcoded URLs** - Frontend uses environment variables
- [x] **Health Check** - `/health` endpoint exists (already present)
- [x] **Environment Variables** - Documented in env.example

## 🚀 Railway Deployment Steps

1. **Push code to GitHub** (or your Git provider)

2. **Create Railway project:**
   - Go to Railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL Database:**
   - In Railway dashboard, click "New" → "Database" → "PostgreSQL"
   - Railway automatically provides `DATABASE_URL` environment variable

4. **Set Environment Variables:**
   In Railway dashboard → Variables tab, set:
   - `BETA_KEY` - Generate with: `openssl rand -hex 32`
   - `SECRET_KEY` - Generate with: `openssl rand -hex 32`
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `ALLOWED_ORIGINS` - Your frontend URL (e.g., `https://your-app.railway.app`)
   - `NEXT_PUBLIC_API_URL` - Your backend URL (if deploying frontend separately)
   - `REDIS_URL` - Your Redis connection string (optional, for caching)
   - `RATE_LIMIT_ENABLED` - `false` or `true` (optional)
   - `RATE_LIMIT_PER_MINUTE` - Number (optional, default: 1000)

5. **Deploy:**
   - Railway automatically detects `railway.json` and `backend/Dockerfile`
   - Railway will build and deploy automatically
   - Check logs in Railway dashboard for any errors

6. **Verify Deployment:**
   - Health check: `https://your-backend.railway.app/health`
   - API docs: `https://your-backend.railway.app/docs`

## 📝 Important Notes

### PORT Variable
- **DO NOT** set PORT manually in Railway
- Railway automatically sets PORT for each service
- The Dockerfile uses `${PORT:-8000}` as fallback

### Database Connection
- Railway PostgreSQL plugin automatically provides `DATABASE_URL`
- Format: `postgresql://user:password@host:port/database`
- No manual configuration needed

### CORS Configuration
- Set `ALLOWED_ORIGINS` to your frontend URL
- Format: `https://your-frontend.railway.app` (comma-separated for multiple)
- Example: `ALLOWED_ORIGINS=https://labmate-frontend.railway.app`

### Frontend API URL
- If deploying frontend separately, set `NEXT_PUBLIC_API_URL` to backend URL
- Example: `NEXT_PUBLIC_API_URL=https://labmate-backend.railway.app`
- This is a build-time variable (must be set before `npm run build`)

## 🔍 Troubleshooting

### "Application failed to respond"
- **Check:** PORT binding in Dockerfile (should use `${PORT:-8000}`)
- **Check:** Host binding (should be `0.0.0.0`, not `localhost`)

### "Module not found"
- **Check:** All dependencies are in `requirements.txt` (Python) or `package.json` (Node)
- **Check:** Build completed successfully in Railway logs

### "Database connection failed"
- **Check:** `DATABASE_URL` is set (Railway auto-sets this for PostgreSQL plugin)
- **Check:** PostgreSQL service is running in Railway dashboard

### "CORS error"
- **Check:** `ALLOWED_ORIGINS` includes your frontend URL
- **Check:** Frontend `NEXT_PUBLIC_API_URL` matches backend URL

## 📋 Files Modified

1. `frontend/Dockerfile` - PORT configuration
2. `frontend/package.json` - Node engines
3. `frontend/app/dashboard/page.tsx` - Remove hardcoded localhost
4. `frontend/app/preview/page.tsx` - Remove hardcoded localhost
5. `env.example` - Railway deployment notes

## ✅ Verification

All changes are minimal and focused on Railway deployment requirements:
- ✅ No breaking changes to local development
- ✅ Backward compatible (uses fallback values)
- ✅ Follows Railway best practices
- ✅ Maintains existing functionality

---

**Ready for Railway deployment!** 🚂

