"""
Rate limiting utilities
"""
from datetime import datetime, timedelta
from typing import Dict, Tuple
import time


# In-memory rate limit storage (use Redis in production)
_rate_limit_store: Dict[str, list] = {}


def check_rate_limit(
    identifier: str,
    max_requests: int = 10,
    time_window_seconds: int = 60
) -> Tuple[bool, int]:
    """
    Check if request should be rate limited
    
    Args:
        identifier: Unique identifier (e.g., IP address, user ID)
        max_requests: Maximum requests allowed in time window
        time_window_seconds: Time window in seconds
        
    Returns:
        Tuple of (is_allowed, remaining_requests)
    """
    current_time = time.time()
    cutoff_time = current_time - time_window_seconds
    
    # Get or create request list for this identifier
    if identifier not in _rate_limit_store:
        _rate_limit_store[identifier] = []
    
    # Remove old requests outside time window
    _rate_limit_store[identifier] = [
        req_time for req_time in _rate_limit_store[identifier]
        if req_time > cutoff_time
    ]
    
    # Check if limit exceeded
    request_count = len(_rate_limit_store[identifier])
    if request_count >= max_requests:
        return False, 0
    
    # Add current request
    _rate_limit_store[identifier].append(current_time)
    
    remaining = max_requests - request_count - 1
    return True, remaining


def clear_rate_limit(identifier: str):
    """
    Clear rate limit for an identifier
    
    Args:
        identifier: Unique identifier to clear
    """
    if identifier in _rate_limit_store:
        del _rate_limit_store[identifier]

