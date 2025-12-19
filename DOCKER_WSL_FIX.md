# Docker WSL Error Fix - "failed to create temp dir"

## 🐛 Error You're Seeing

```
Error response from daemon: failed to create temp dir: stat /mnt/host/wslg/runtime-dir: no such file or directory
```

This is a **Docker Desktop WSL2 integration issue** on Windows.

---

## ✅ Quick Fixes (Try in Order)

### **Fix 1: Restart Docker Desktop** (Easiest)

1. **Close Docker Desktop completely**
   - Right-click Docker icon in system tray
   - Click "Quit Docker Desktop"

2. **Restart Docker Desktop**
   - Open Docker Desktop again
   - Wait for it to fully start (whale icon stops animating)

3. **Try again**:
   ```bash
   docker-compose up --build
   ```

---

### **Fix 2: Update Docker Desktop**

1. **Check Docker Desktop version**:
   - Open Docker Desktop
   - Settings → General → Check version
   - Should be **4.25.0 or newer**

2. **If outdated, update**:
   - Download latest from: https://www.docker.com/products/docker-desktop
   - Install and restart

---

### **Fix 3: Reset WSL Integration**

1. **Open Docker Desktop**
2. **Go to Settings** → **Resources** → **WSL Integration**
3. **Uncheck** your WSL distribution
4. **Click "Apply & Restart"**
5. **Re-check** your WSL distribution
6. **Click "Apply & Restart"** again

---

### **Fix 4: Restart WSL**

1. **Open PowerShell as Administrator**
2. **Run**:
   ```powershell
   wsl --shutdown
   ```
3. **Wait 10 seconds**
4. **Restart your WSL terminal**
5. **Try Docker again**:
   ```bash
   docker-compose up --build
   ```

---

### **Fix 5: Update WSL**

1. **Open PowerShell as Administrator**
2. **Update WSL**:
   ```powershell
   wsl --update
   ```
3. **Set default version**:
   ```powershell
   wsl --set-default-version 2
   ```
4. **Restart Docker Desktop**

---

### **Fix 6: Fix Docker Context**

1. **Check Docker context**:
   ```bash
   docker context ls
   ```

2. **If not using "desktop-linux", switch**:
   ```bash
   docker context use desktop-linux
   ```

3. **Or reset to default**:
   ```bash
   docker context use default
   ```

---

### **Fix 7: Clean Docker System** (If above don't work)

1. **Stop all containers**:
   ```bash
   docker-compose down
   ```

2. **Prune Docker system**:
   ```bash
   docker system prune -a --volumes
   ```
   ⚠️ **Warning**: This removes all unused containers, images, and volumes

3. **Restart Docker Desktop**

4. **Try again**:
   ```bash
   docker-compose up --build
   ```

---

### **Fix 8: Reinstall Docker Desktop** (Last Resort)

1. **Uninstall Docker Desktop**:
   - Windows Settings → Apps → Docker Desktop → Uninstall

2. **Clean up**:
   ```powershell
   # Remove Docker data (optional, but recommended)
   Remove-Item -Recurse -Force "$env:USERPROFILE\.docker"
   ```

3. **Download and install fresh**:
   - https://www.docker.com/products/docker-desktop
   - Install with WSL2 backend

4. **Restart computer**

5. **Try again**

---

## 🔍 Diagnostic Commands

### **Check Docker Status**:
```bash
docker info
```

### **Check WSL Integration**:
```bash
docker context ls
```

### **Check WSL Version**:
```powershell
wsl --list --verbose
```

### **Test Docker**:
```bash
docker run hello-world
```

---

## 🎯 Most Likely Solution

**90% of the time, this fixes it**:

1. **Restart Docker Desktop** (Fix 1)
2. **Restart WSL** (Fix 4)
3. **Try again**

If that doesn't work:
- **Reset WSL Integration** (Fix 3)
- **Update Docker Desktop** (Fix 2)

---

## 📋 Step-by-Step Recommended Fix

### **Step 1: Quick Restart**
```powershell
# In PowerShell (Admin)
wsl --shutdown
```
Then restart Docker Desktop manually.

### **Step 2: Reset WSL Integration**
1. Docker Desktop → Settings → Resources → WSL Integration
2. Toggle your WSL distro off and on
3. Apply & Restart

### **Step 3: Test**
```bash
docker run hello-world
```

### **Step 4: Try Your Project**
```bash
cd /path/to/labmate-clean
docker-compose up --build
```

---

## ⚠️ Alternative: Use Docker Without WSL

If WSL continues to cause issues, you can use Docker directly on Windows:

1. **Docker Desktop Settings** → **General**
2. **Uncheck** "Use the WSL 2 based engine"
3. **Apply & Restart**
4. **Note**: This may be slower, but should work

---

## 🆘 Still Not Working?

### **Check These**:

1. **Windows Version**: Should be Windows 10/11 with WSL2 support
2. **WSL2 Installed**: `wsl --list --verbose` shows version 2
3. **Docker Desktop Updated**: Latest version installed
4. **Antivirus**: May be blocking Docker (add exception)
5. **Firewall**: May be blocking Docker (add exception)

### **Get More Help**:

1. **Docker Desktop Logs**:
   - Help → Troubleshoot → View Logs

2. **WSL Logs**:
   ```powershell
   wsl --list --verbose
   ```

3. **Docker Community**:
   - https://forums.docker.com
   - https://github.com/docker/for-win/issues

---

## ✅ Success Indicators

After fixing, you should see:
```bash
$ docker-compose up --build
Building backend...
Building frontend...
Starting postgres...
Starting backend...
Starting frontend...
```

No errors! 🎉

---

**Try Fix 1 and Fix 4 first - they solve 90% of these issues!**

