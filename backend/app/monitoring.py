"""Monitoring and logging utilities for performance tracking"""
import asyncio
import logging
import time
from functools import wraps
from typing import Callable, Any
from fastapi import Request
import json
import os
log_dir = os.getenv('LOG_DIR', '/app/logs')
os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(log_dir, 'app.log'), mode='a')
    ]
)

logger = logging.getLogger(__name__)


def log_request_time(func: Callable) -> Callable:
    """Decorator to log request processing time"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            processing_time = time.time() - start_time
            
            # Log slow requests (> 1 second)
            if processing_time > 1.0:
                logger.warning(
                    f"Slow request: {func.__name__} took {processing_time:.2f}s",
                    extra={
                        "function": func.__name__,
                        "processing_time": processing_time,
                        "status": "success"
                    }
                )
            else:
                logger.info(
                    f"Request completed: {func.__name__} in {processing_time:.2f}s",
                    extra={
                        "function": func.__name__,
                        "processing_time": processing_time
                    }
                )
            
            return result
        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(
                f"Request failed: {func.__name__} after {processing_time:.2f}s - {str(e)}",
                extra={
                    "function": func.__name__,
                    "processing_time": processing_time,
                    "error": str(e),
                    "status": "error"
                },
                exc_info=True
            )
            raise
    
    return wrapper


def get_db_pool_status() -> dict:
    """Inspect SQLAlchemy connection pool metrics safely across backends."""
    try:
        from .database import engine
        if engine is None or not hasattr(engine, "pool"):
            return {"status": "unconfigured"}
        pool = engine.pool
        info = {
            "pool_type": type(pool).__name__,
        }
        for attr in ("size", "checkedin", "checkedout", "overflow"):
            val = getattr(pool, attr, None)
            if callable(val):
                try:
                    info[attr] = val()
                except Exception:
                    pass
            elif val is not None:
                info[attr] = val
        return info
    except Exception as e:
        return {"error": str(e)}


class EventLoopLagMonitor:
    """Measures event-loop lag (latency between timer trigger and actual execution)."""

    def __init__(self, interval: float = 0.5):
        self.interval = interval
        self.running = False
        self._task = None
        self.lag_history = []
        self.max_history = 120
        self.current_lag_ms = 0.0
        self.peak_lag_ms = 0.0
        self.total_samples = 0

    async def start(self):
        if self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._run())

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None

    async def _run(self):
        while self.running:
            start = time.perf_counter()
            try:
                await asyncio.sleep(self.interval)
            except asyncio.CancelledError:
                break
            actual = time.perf_counter() - start
            lag_ms = max(0.0, (actual - self.interval) * 1000.0)
            self.current_lag_ms = round(lag_ms, 2)
            if lag_ms > self.peak_lag_ms:
                self.peak_lag_ms = round(lag_ms, 2)
            self.lag_history.append((time.time(), self.current_lag_ms))
            if len(self.lag_history) > self.max_history:
                self.lag_history.pop(0)
            self.total_samples += 1
            if lag_ms > 200.0:
                logger.warning("Event-loop lag alert: %.2fms", lag_ms)

    def get_metrics(self) -> dict:
        recent = [l for _, l in self.lag_history]
        avg_lag = sum(recent) / len(recent) if recent else 0.0
        return {
            "current_lag_ms": self.current_lag_ms,
            "peak_lag_ms": self.peak_lag_ms,
            "avg_lag_ms": round(avg_lag, 2),
            "total_samples": self.total_samples,
        }


class PerformanceMonitor:
    """Monitor application performance metrics"""
    
    def __init__(self):
        self.metrics = {
            "requests_total": 0,
            "requests_success": 0,
            "requests_error": 0,
            "avg_response_time": 0,
            "slow_requests": []
        }
        self.loop_monitor = EventLoopLagMonitor()

    async def start_monitoring(self, interval: float = 0.5):
        self.loop_monitor.interval = interval
        await self.loop_monitor.start()

    async def stop_monitoring(self):
        await self.loop_monitor.stop()
    
    def record_request(self, duration: float, success: bool = True):
        """Record a request metric"""
        self.metrics["requests_total"] += 1
        
        if success:
            self.metrics["requests_success"] += 1
        else:
            self.metrics["requests_error"] += 1
        
        # Update average response time
        total = self.metrics["requests_total"]
        current_avg = self.metrics["avg_response_time"]
        self.metrics["avg_response_time"] = (
            (current_avg * (total - 1) + duration) / total
        )
        
        # Track slow requests
        if duration > 1.0:
            self.metrics["slow_requests"].append({
                "duration": duration,
                "timestamp": time.time()
            })
            # Keep only last 100 slow requests
            if len(self.metrics["slow_requests"]) > 100:
                self.metrics["slow_requests"].pop(0)
    
    def get_metrics(self) -> dict:
        """Get current performance metrics"""
        lag_metrics = self.loop_monitor.get_metrics()
        return {
            **self.metrics,
            "error_rate": (
                self.metrics["requests_error"] / self.metrics["requests_total"]
                if self.metrics["requests_total"] > 0
                else 0
            ),
            "event_loop_lag": lag_metrics,
            "event_loop_lag_ms": lag_metrics["current_lag_ms"],
            "db_pool": get_db_pool_status(),
        }
    
    def reset(self):
        """Reset metrics"""
        self.metrics = {
            "requests_total": 0,
            "requests_success": 0,
            "requests_error": 0,
            "avg_response_time": 0,
            "slow_requests": []
        }
        self.loop_monitor.current_lag_ms = 0.0
        self.loop_monitor.peak_lag_ms = 0.0
        self.loop_monitor.lag_history.clear()
        self.loop_monitor.total_samples = 0


# Global performance monitor instance
performance_monitor = PerformanceMonitor()

