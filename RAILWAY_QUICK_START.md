# 🚂 Railway Quick Start - 5 Minute Setup

## Quick Checklist

### ✅ Step 1: Push to GitHub
```bash
git push origin main
```

### ✅ Step 2: Create Railway Project
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub"
4. Select your repository

### ✅ Step 3: Add PostgreSQL
1. Click "+ New" → "Database" → "PostgreSQL"
2. Railway auto-creates `DATABASE_URL`

### ✅ Step 4: Set Environment Variables
Go to service → Variables → Add:

```bash
BETA_KEY=<generate: openssl rand -hex 32>
SECRET_KEY=<generate: openssl rand -hex 32>
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
ALLOWED_ORIGINS=https://your-app.railway.app
RATE_LIMIT_ENABLED=true
```

### ✅ Step 5: Add Volumes (IMPORTANT!)
Service → Settings → Volumes → Add:
- `/app/uploads` → `uploads`
- `/app/screenshots` → `screenshots`
- `/app/reports` → `reports`

### ✅ Step 6: Deploy!
Railway auto-deploys. Check:
- `https://your-app.railway.app/health`
- `https://your-app.railway.app/docs`

---

## 🚨 Critical Notes

1. **Docker-in-Docker won't work** - Code execution disabled
2. **Add volumes** - Or files will be lost on redeploy
3. **Generate secure keys** - Don't use defaults

---

## 📖 Full Guide

See `RAILWAY_DEPLOYMENT_COMPLETE_GUIDE.md` for detailed instructions.



