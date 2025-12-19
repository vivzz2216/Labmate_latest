"""Redis caching utilities for performance optimization"""
import redis
import json
from typing import Optional, Any
from .config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Redis connection pool
try:
    # Parse Redis URL to handle both local and cloud Redis
    redis_url = settings.REDIS_URL
    
    # For Redis Labs cloud instances, ensure SSL is handled properly
    # Most Redis Labs instances require SSL, but the connection string format handles it
    redis_client = redis.from_url(
        redis_url,
        decode_responses=True,
        socket_connect_timeout=10,  # Increased timeout for cloud connections
        socket_timeout=10,
        retry_on_timeout=True,
        health_check_interval=30,
        socket_keepalive=True,  # Keep connection alive for cloud Redis
        socket_keepalive_options={}  # TCP keepalive options
    )
    # Test connection
    redis_client.ping()
    logger.info(f"✓ Redis connection established: {redis_url.split('@')[-1] if '@' in redis_url else redis_url}")
except Exception as e:
    logger.warning(f"⚠ Redis not available: {e}. Caching will be disabled.")
    logger.warning(f"Redis URL was: {settings.REDIS_URL.split('@')[-1] if '@' in settings.REDIS_URL else settings.REDIS_URL}")
    redis_client = None


class Cache:
    """Simple caching wrapper for Redis"""
    
    @staticmethod
    def get(key: str) -> Optional[Any]:
        """Get value from cache"""
        if not redis_client:
            return None
        
        try:
            value = redis_client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
        return None
    
    @staticmethod
    def set(key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with optional TTL"""
        if not redis_client:
            return False
        
        try:
            ttl = ttl or settings.REDIS_CACHE_TTL
            serialized = json.dumps(value)
            redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
        return False
    
    @staticmethod
    def delete(key: str) -> bool:
        """Delete key from cache"""
        if not redis_client:
            return False
        
        try:
            redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
        return False
    
    @staticmethod
    def delete_pattern(pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not redis_client:
            return 0
        
        try:
            keys = redis_client.keys(pattern)
            if keys:
                return redis_client.delete(*keys)
        except Exception as e:
            logger.error(f"Cache delete_pattern error for pattern {pattern}: {e}")
        return 0
    
    @staticmethod
    def exists(key: str) -> bool:
        """Check if key exists in cache"""
        if not redis_client:
            return False
        
        try:
            return redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"Cache exists error for key {key}: {e}")
        return False


# Cache key generators
def cache_key_upload(upload_id: int) -> str:
    """Generate cache key for upload"""
    return f"upload:{upload_id}"


def cache_key_parse(upload_id: int) -> str:
    """Generate cache key for parsed tasks"""
    return f"parse:{upload_id}"


def cache_key_job(job_id: int) -> str:
    """Generate cache key for job status"""
    return f"job:{job_id}"


def cache_key_ai_job(job_id: int) -> str:
    """Generate cache key for AI job status"""
    return f"ai_job:{job_id}"

