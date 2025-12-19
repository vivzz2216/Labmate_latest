"""Monitoring and logging utilities for performance tracking"""
import logging
import time
from functools import wraps
from typing import Callable, Any
from fastapi import Request
import json

# Configure logging
import os
os.makedirs('/app/logs', exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/app/logs/app.log', mode='a')
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
        return {
            **self.metrics,
            "error_rate": (
                self.metrics["requests_error"] / self.metrics["requests_total"]
                if self.metrics["requests_total"] > 0
                else 0
            )
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


# Global performance monitor instance
performance_monitor = PerformanceMonitor()

