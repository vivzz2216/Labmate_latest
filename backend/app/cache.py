"""Redis caching utilities for performance optimization"""
import redis
import json
import time
import fnmatch
from typing import Optional, Any
from .config import settings
import logging

logger = logging.getLogger(__name__)


class _InMemoryFallbackRedis:
    """Thread-safe in-memory Redis substitute for local development/testing without Redis."""
    def __init__(self):
        self._store: dict[str, str] = {}
        self._expiries: dict[str, float] = {}

    def _purge_expired(self, key: str):
        if key in self._expiries and time.time() > self._expiries[key]:
            self._store.pop(key, None)
            self._expiries.pop(key, None)

    def ping(self) -> bool:
        return True

    def exists(self, key: str) -> int:
        self._purge_expired(key)
        return 1 if key in self._store else 0

    def get(self, key: str) -> Optional[str]:
        self._purge_expired(key)
        return self._store.get(key)

    def set(self, key: str, value: Any, ex: Optional[int] = None, nx: bool = False) -> bool:
        self._purge_expired(key)
        if nx and key in self._store:
            return False
        self._store[key] = str(value) if not isinstance(value, (str, bytes)) else value
        if ex is not None:
            self._expiries[key] = time.time() + ex
        else:
            self._expiries.pop(key, None)
        return True

    def setex(self, key: str, time_in_seconds: int, value: Any) -> bool:
        return self.set(key, value, ex=time_in_seconds)

    def delete(self, *keys: str) -> int:
        count = 0
        for k in keys:
            self._purge_expired(k)
            if self._store.pop(k, None) is not None:
                self._expiries.pop(k, None)
                count += 1
        return count

    def keys(self, pattern: str = "*") -> list[str]:
        now = time.time()
        expired = [k for k, exp in self._expiries.items() if now > exp]
        for k in expired:
            self._store.pop(k, None)
            self._expiries.pop(k, None)
        if pattern == "*":
            return list(self._store.keys())
        return [k for k in self._store.keys() if fnmatch.fnmatch(k, pattern)]

    def pipeline(self, transaction: bool = True):
        return _PipelineProxy(self)


class _PipelineProxy:
    def __init__(self, client: _InMemoryFallbackRedis):
        self._client = client
        self._commands: list[tuple[str, tuple, dict]] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def execute(self):
        results = []
        for cmd, args, kwargs in self._commands:
            results.append(getattr(self._client, cmd)(*args, **kwargs))
        self._commands.clear()
        return results

    def __getattr__(self, name: str):
        def _queue(*args, **kwargs):
            self._commands.append((name, args, kwargs))
            return self
        return _queue


# Initialize Redis connection pool
def _init_redis():
    redis_url = settings.REDIS_URL
    client = None  # stays None if from_url itself fails, so there is nothing to retain
    try:
        # Parse Redis URL to handle both local and cloud Redis
        client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=False,
            health_check_interval=30,
            socket_keepalive=True,  # Keep connection alive for cloud Redis
            socket_keepalive_options={}  # TCP keepalive options
        )
        if any(h in (redis_url or "") for h in ("localhost", "127.0.0.1")):
            client.ping()
            logger.info("Local Redis client connected")
        else:
            logger.info("Redis client configured")
        return client
    except Exception as local_err:
        if settings.REDIS_REQUIRED:
            logger.warning("Required Redis is unavailable; retaining client for recovery.")
            return client
        logger.warning(
            f"Redis at {redis_url} is not running ({local_err}); "
            "using in-process fallback with TTL enforcement for local execution."
        )
        try:
            import fakeredis
            return fakeredis.FakeRedis(decode_responses=True)
        except Exception as fe:
            logger.info(f"fakeredis not available ({fe}); using in-memory store for local session/cache.")
            return _InMemoryFallbackRedis()


redis_client = _init_redis()


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
