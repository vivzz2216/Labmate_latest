"""
Background task processing service using asyncio
For production, consider using Celery + Redis
"""
import asyncio
import logging
from typing import Callable, Any, Dict
from ..cache import redis_client

logger = logging.getLogger(__name__)

# In-memory task queue (for MVP - use Celery in production)
_task_queue: asyncio.Queue = asyncio.Queue()
_task_workers_running = False
_task_workers: list = []


async def _background_worker(worker_id: int):
    """
    Background worker that processes tasks from the queue
    """
    logger.info(f"Background worker {worker_id} started")
    
    while True:
        try:
            # Get task from queue (with timeout to allow graceful shutdown)
            try:
                task_func, task_args, task_kwargs = await asyncio.wait_for(
                    _task_queue.get(), timeout=1.0
                )
            except asyncio.TimeoutError:
                continue
            
            try:
                # Execute the task
                logger.debug(f"Worker {worker_id} processing task: {task_func.__name__}")
                if asyncio.iscoroutinefunction(task_func):
                    await task_func(*task_args, **task_kwargs)
                else:
                    task_func(*task_args, **task_kwargs)
                logger.debug(f"Worker {worker_id} completed task: {task_func.__name__}")
            except Exception as e:
                logger.error(f"Worker {worker_id} task failed: {e}", exc_info=True)
            finally:
                _task_queue.task_done()
                
        except asyncio.CancelledError:
            logger.info(f"Background worker {worker_id} cancelled")
            break
        except Exception as e:
            logger.error(f"Background worker {worker_id} error: {e}", exc_info=True)
            await asyncio.sleep(1)  # Brief pause before retrying


def start_background_workers(num_workers: int = 3):
    """
    Start background worker threads
    
    Args:
        num_workers: Number of worker threads to start
    """
    global _task_workers_running, _task_workers
    
    if _task_workers_running:
        logger.warning("Background workers already running")
        return
    
    _task_workers_running = True
    _task_workers = []
    
    for i in range(num_workers):
        worker = asyncio.create_task(_background_worker(i))
        _task_workers.append(worker)
        logger.info(f"Started background worker {i}")
    
    logger.info(f"Started {num_workers} background workers")


def stop_background_workers():
    """
    Stop all background worker threads gracefully
    """
    global _task_workers_running, _task_workers
    
    if not _task_workers_running:
        return
    
    logger.info("Stopping background workers...")
    _task_workers_running = False
    
    # Cancel all workers
    for worker in _task_workers:
        worker.cancel()
    
    # Wait for workers to finish
    if _task_workers:
        asyncio.gather(*_task_workers, return_exceptions=True)
    
    _task_workers = []
    logger.info("Background workers stopped")


async def enqueue_task(
    task_func: Callable,
    *args: Any,
    **kwargs: Any
) -> None:
    """
    Enqueue a task for background processing
    
    Args:
        task_func: Function to execute (can be async or sync)
        *args: Positional arguments for the function
        **kwargs: Keyword arguments for the function
        
    Note:
        For production, use Celery with Redis broker instead
    """
    try:
        await _task_queue.put((task_func, args, kwargs))
        logger.debug(f"Task enqueued: {task_func.__name__}")
    except Exception as e:
        logger.error(f"Failed to enqueue task: {e}", exc_info=True)
        raise


def get_queue_size() -> int:
    """
    Get current queue size
    
    Returns:
        Number of tasks in queue
    """
    return _task_queue.qsize()


def is_workers_running() -> bool:
    """
    Check if background workers are running
    
    Returns:
        True if workers are running
    """
    return _task_workers_running

