# 🚀 Quick Docker WSL Fix

## Try These (In Order):

### 1️⃣ Restart Everything (30 seconds)
```powershell
# PowerShell (Admin)
wsl --shutdown
```
Then restart Docker Desktop manually.

### 2️⃣ Reset WSL Integration (1 minute)
1. Docker Desktop → Settings → Resources → WSL Integration
2. Uncheck your WSL distro → Apply & Restart
3. Re-check your WSL distro → Apply & Restart

### 3️⃣ Try Again
```bash
docker-compose up --build
```

---

## If Still Failing:

### 4️⃣ Update Docker Desktop
- Download latest from docker.com
- Install and restart

### 5️⃣ Clean Docker
```bash
docker system prune -a --volumes
docker-compose up --build
```

---

**90% of the time, Fix 1 + Fix 2 solves it!**

See `DOCKER_WSL_FIX.md` for detailed troubleshooting.

