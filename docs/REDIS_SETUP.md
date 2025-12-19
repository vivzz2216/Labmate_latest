# Redis Setup Guide

## ✅ Your Redis Labs Configuration

Your Redis Labs instance is configured and ready to use:

**Connection String:**
```
redis://default:hkIdOTA6qPbssm2aHVzjEjr7Ml1jPTi1@redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706
```

## 🔧 Setup Instructions

### 1. Update Environment Variables

Add this to your `.env` file:

```bash
REDIS_URL=redis://default:hkIdOTA6qPbssm2aHVzjEjr7Ml1jPTi1@redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706
```

Or set it as an environment variable:

```bash
export REDIS_URL=redis://default:hkIdOTA6qPbssm2aHVzjEjr7Ml1jPTi1@redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706
```

### 2. For Docker Compose

The `docker-compose.yml` is already configured to use the `REDIS_URL` environment variable. Just make sure it's set:

```bash
# In your .env file or export before running docker-compose
export REDIS_URL=redis://default:hkIdOTA6qPbssm2aHVzjEjr7Ml1jPTi1@redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706

# Then start services
docker-compose up --build
```

### 3. Verify Connection

After starting the backend, check the logs:

```bash
docker-compose logs backend | grep Redis
```

You should see:
```
✓ Redis connection established: redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706
```

Or check the health endpoint:

```bash
curl http://localhost:8000/health
```

The response should show:
```json
{
  "status": "healthy",
  "services": {
    "redis": "healthy"
  }
}
```

## 🧪 Test Redis Connection

You can test the connection directly using redis-cli:

```bash
redis-cli -u redis://default:hkIdOTA6qPbssm2aHVzjEjr7Ml1jPTi1@redis-19706.c281.us-east-1-2.ec2.cloud.redislabs.com:19706
```

Then try:
```redis
PING
# Should return: PONG

SET test "Hello Redis"
GET test
# Should return: "Hello Redis"
```

## 📊 Redis Usage

Your Redis instance will be used for:

1. **Caching**: Frequently accessed data (uploads, parsed tasks, job status)
   - Default TTL: 1 hour (3600 seconds)
   - Configurable via `REDIS_CACHE_TTL` environment variable

2. **Rate Limiting**: IP-based rate limiting
   - Default: 60 requests per minute per IP
   - Configurable via `RATE_LIMIT_PER_MINUTE`

## 🔒 Security Notes

- **Keep your Redis password secure**: Don't commit it to version control
- **Use environment variables**: Store sensitive credentials in `.env` file
- **Add `.env` to `.gitignore`**: Ensure it's not committed

## 🐛 Troubleshooting

### Connection Timeout
If you see connection timeout errors:
- Check that your server/container can reach the Redis Labs host
- Verify the connection string is correct
- Check firewall/network settings

### Authentication Failed
If you see authentication errors:
- Verify the password in the connection string
- Check Redis Labs dashboard for any password changes
- Ensure the username is correct (usually "default")

### SSL/TLS Issues
If your Redis Labs instance requires SSL:
- The connection string format should work automatically
- If issues persist, check Redis Labs documentation for SSL configuration

## 📈 Monitoring

Monitor your Redis usage in the Redis Labs dashboard:
- Memory usage
- Connection count
- Operations per second
- Data eviction (if memory limit reached)

## 💡 Tips

1. **Memory Management**: Redis Labs has memory limits. Monitor usage to avoid evictions
2. **Connection Pooling**: The application uses connection pooling for efficiency
3. **TTL Strategy**: Adjust `REDIS_CACHE_TTL` based on your data freshness requirements
4. **Rate Limiting**: Adjust `RATE_LIMIT_PER_MINUTE` based on your traffic patterns

---

**Your Redis is ready to use!** Just set the `REDIS_URL` environment variable and restart your services.

