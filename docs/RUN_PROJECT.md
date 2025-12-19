# How to Run LabMate AI Project

## Prerequisites

1. **Docker Desktop** must be installed and running
2. **.env file** with your Redis URL configured

## Quick Start

### Step 1: Start Docker Desktop
Make sure Docker Desktop is running on your Windows machine.

### Step 2: Verify Environment
Your `.env` file should contain:
```bash
REDIS_URL=redis://default:hkIdOTA6qPbssm2aHVzjEjr7Ml1jPTi1@redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706
```

### Step 3: Start Services
```bash
docker-compose up -d --build
```

This will:
- Build and start PostgreSQL (optimized)
- Start Backend API (4 workers)
- Start Frontend (Next.js)
- Connect to your Redis Labs instance

### Step 4: Wait for Services
Wait about 30-60 seconds for all services to start up, then check status:

```bash
docker-compose ps
```

### Step 5: Verify Everything is Running

**Check Backend Health:**
```bash
curl http://localhost:8000/health
```

**Check Backend Logs:**
```bash
docker-compose logs backend | grep -i redis
```

You should see:
```
✓ Redis connection established: redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706
```

**Check All Services:**
```bash
docker-compose logs --tail=50
```

## Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Run Database Migration

After services are up, run the performance indexes migration:

```bash
docker-compose exec postgres psql -U labmate -d labmate_db -c "CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);"
docker-compose exec postgres psql -U labmate -d labmate_db -c "CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_at ON uploads(uploaded_at DESC);"
docker-compose exec postgres psql -U labmate -d labmate_db -c "CREATE INDEX IF NOT EXISTS idx_jobs_upload_id ON jobs(upload_id);"
docker-compose exec postgres psql -U labmate -d labmate_db -c "CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);"
```

Or run the full migration file:
```bash
docker-compose exec -T postgres psql -U labmate -d labmate_db < backend/migrations/004_add_performance_indexes.sql
```

## Useful Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Stop Services
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild and Restart
```bash
docker-compose up -d --build
```

### Check Service Status
```bash
docker-compose ps
```

### View Resource Usage
```bash
docker stats
```

## Troubleshooting

### Docker Desktop Not Running
**Error**: `unable to get image 'postgres:15': error during connect`

**Solution**: 
1. Open Docker Desktop application
2. Wait for it to fully start (whale icon in system tray)
3. Try again: `docker-compose up -d --build`

### Port Already in Use
**Error**: `Bind for 0.0.0.0:8000 failed: port is already allocated`

**Solution**:
- Stop the service using the port: `docker-compose down`
- Or change the port in `docker-compose.yml`

### Redis Connection Failed
**Error**: `⚠ Redis not available`

**Solution**:
1. Check your Redis URL in `.env` file
2. Verify Redis Labs instance is running
3. Check network connectivity
4. Try testing connection: `redis-cli -u redis://default:hkIdOTA6qPbssm2aHVzjEjr7Ml1jPTi1@redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706`

### Database Connection Issues
**Error**: Database connection failed

**Solution**:
1. Wait for PostgreSQL to fully start (check logs)
2. Verify DATABASE_URL in environment
3. Check PostgreSQL logs: `docker-compose logs postgres`

## Performance Monitoring

### Check Health Endpoint
```bash
curl http://localhost:8000/health
```

Expected response:
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

### Monitor Performance
- Backend logs show request processing times
- Health endpoint shows metrics
- Check Redis memory usage in Redis Labs dashboard

## Next Steps

1. ✅ Services are running
2. ✅ Redis connected
3. ✅ Database optimized
4. 🚀 Ready for 1000+ users!

---

**Need Help?** Check the logs: `docker-compose logs -f`

