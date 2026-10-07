# Quick Setup Guide - Performance & SEO Optimizations

## 🚀 Quick Start

### 1. Update Environment Variables

Add these to your `.env` file or environment:

```bash
# Redis (optional but recommended for caching)
REDIS_URL=redis://redis:6379/0

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60

# SEO (for frontend)
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_GOOGLE_VERIFICATION=your_google_verification_code
```

### 2. Run Database Migration

Apply the performance indexes:

```bash
# Using docker-compose
docker-compose exec postgres psql -U labmate -d labmate_db -f /app/migrations/004_add_performance_indexes.sql

# Or manually
psql -U labmate -d labmate_db -f backend/migrations/004_add_performance_indexes.sql
```

### 3. Start Services

```bash
docker-compose up --build
```

This will start:
- PostgreSQL (optimized for performance)
- Redis (for caching)
- Backend (4 workers)
- Frontend (Next.js)

### 4. Verify Setup

Check health endpoint:
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

## 📊 Performance Monitoring

### View Logs
```bash
# Backend logs
docker-compose logs -f backend

# Redis logs
docker-compose logs -f redis

# All logs
docker-compose logs -f
```

### Check Performance Metrics
- Health endpoint: `GET /health`
- API docs: `http://localhost:8000/docs`

## 🔍 SEO Verification

### Check Sitemap
Visit: `http://localhost:3000/sitemap.xml`

### Check Robots.txt
Visit: `http://localhost:3000/robots.txt`

### Verify Meta Tags
Use browser dev tools or:
```bash
curl http://localhost:3000 | grep -i "og:"
```

## ⚙️ Configuration Options

### Redis Caching
- **Default TTL**: 1 hour (3600 seconds)
- **Configurable**: Set `REDIS_CACHE_TTL` environment variable
- **Graceful Degradation**: Works without Redis (caching disabled)

### Rate Limiting
- **Default**: 60 requests/minute per IP
- **Configurable**: Set `RATE_LIMIT_PER_MINUTE`
- **Disable**: Set `RATE_LIMIT_ENABLED=false`

### Database Pool
- **Pool Size**: 20 connections
- **Max Overflow**: 40 connections
- **Recycle**: Every 5 minutes

### Backend Workers
- **Workers**: 4 (configurable in docker-compose.yml)
- **Formula**: (2 × CPU cores) + 1

## 🐛 Troubleshooting

### Redis Connection Issues
If Redis is not available:
- Application will continue to work
- Caching will be disabled
- Check `REDIS_URL` environment variable

### Database Slow Queries
- Verify indexes are created: Check migration `004_add_performance_indexes.sql`
- Monitor connection pool usage
- Check PostgreSQL logs

### High Memory Usage
- Reduce number of workers in docker-compose.yml
- Adjust Redis memory limit
- Monitor with: `docker stats`

## 📈 Performance Benchmarks

### Expected Performance
- **API Response Time**: <200ms (cached), <500ms (uncached)
- **Database Query Time**: <50ms (with indexes)
- **Cache Hit Rate**: >70% (after warm-up)
- **Concurrent Users**: 1000+ supported

### Load Testing
Use tools like:
- Apache Bench: `ab -n 1000 -c 100 http://localhost:8000/health`
- wrk: `wrk -t4 -c100 -d30s http://localhost:8000/health`

## 🔐 Security Notes

- Rate limiting helps prevent abuse
- Security headers are configured in Next.js
- Database connections are pooled and recycled
- Redis is internal (not exposed externally)

## 📝 Next Steps

1. **Production Deployment**:
   - Use environment-specific configurations
   - Set up proper secrets management
   - Configure CDN for static assets
   - Set up monitoring (Grafana/Prometheus)

2. **Further Optimizations**:
   - Add CDN for images
   - Implement background job processing (Celery)
   - Add database read replicas
   - Set up load balancing

3. **Monitoring**:
   - Set up alerts for slow requests
   - Monitor error rates
   - Track cache hit rates
   - Monitor database connection pool usage

---

For detailed information, see `OPTIMIZATION_SUMMARY.md`

