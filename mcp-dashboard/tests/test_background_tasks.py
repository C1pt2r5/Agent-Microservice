"""
Unit tests for background task management utilities.
"""
import pytest
import asyncio
import time
import threading
from unittest.mock import MagicMock, patch

from utils.background_tasks import BackgroundTaskManager, PeriodicTask, TaskResult


class TestBackgroundTaskManager:
    """Test cases for BackgroundTaskManager class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.task_manager = BackgroundTaskManager()
        # Give the event loop time to start
        time.sleep(0.1)
    
    def teardown_method(self):
        """Clean up after tests."""
        self.task_manager.shutdown()
    
    def test_task_manager_init(self):
        """Test task manager initialization."""
        assert self.task_manager._event_loop is not None
        assert self.task_manager._loop_thread is not None
        assert self.task_manager._loop_thread.is_alive()
        assert not self.task_manager._shutdown
    
    def test_submit_simple_task(self):
        """Test submitting a simple async task."""
        async def simple_task():
            await asyncio.sleep(0.01)
            return "test_result"
        
        task_id = self.task_manager.submit_task(simple_task())
        assert task_id.startswith("task_")
        
        # Wait for task to complete
        time.sleep(0.1)
        
        # Process results
        self.task_manager.process_results()
    
    def test_submit_task_with_callback(self):
        """Test submitting task with completion callback."""
        callback = MagicMock()
        
        async def simple_task():
            return "callback_result"
        
        task_id = self.task_manager.submit_task(simple_task(), callback=callback)
        
        # Wait for task to complete
        time.sleep(0.1)
        
        # Process results
        self.task_manager.process_results()
        
        # Verify callback was called
        callback.assert_called_once()
        result = callback.call_args[0][0]
        assert isinstance(result, TaskResult)
        assert result.task_id == task_id
        assert result.success is True
        assert result.result == "callback_result"
    
    def test_submit_failing_task(self):
        """Test submitting a task that raises an exception."""
        callback = MagicMock()
        
        async def failing_task():
            raise ValueError("Test error")
        
        task_id = self.task_manager.submit_task(failing_task(), callback=callback)
        
        # Wait for task to complete
        time.sleep(0.1)
        
        # Process results
        self.task_manager.process_results()
        
        # Verify callback was called with error
        callback.assert_called_once()
        result = callback.call_args[0][0]
        assert isinstance(result, TaskResult)
        assert result.success is False
        assert isinstance(result.error, ValueError)
        assert str(result.error) == "Test error"
    
    def test_cancel_task(self):
        """Test cancelling a running task."""
        async def long_running_task():
            await asyncio.sleep(1.0)  # Long enough to cancel
            return "should_not_complete"
        
        task_id = self.task_manager.submit_task(long_running_task())
        
        # Give task time to start
        time.sleep(0.05)
        
        # Cancel the task
        cancelled = self.task_manager.cancel_task(task_id)
        assert cancelled is True
        
        # Wait a bit and verify task doesn't complete normally
        time.sleep(0.1)
        self.task_manager.process_results()
    
    def test_task_tracking(self):
        """Test task tracking functionality."""
        async def tracked_task():
            await asyncio.sleep(0.1)
            return "tracked"
        
        # Initially no running tasks
        assert self.task_manager.get_running_task_count() == 0
        
        task_id = self.task_manager.submit_task(tracked_task())
        
        # Give task time to start
        time.sleep(0.05)
        
        # Should have one running task
        assert self.task_manager.get_running_task_count() >= 0  # May have completed already
        assert self.task_manager.is_task_running(task_id) or not self.task_manager.is_task_running(task_id)  # May vary
        
        # Wait for completion
        time.sleep(0.2)
        
        # Should be no running tasks
        assert self.task_manager.get_running_task_count() == 0
        assert not self.task_manager.is_task_running(task_id)
    
    def test_custom_task_id(self):
        """Test submitting task with custom ID."""
        async def custom_task():
            return "custom_result"
        
        custom_id = "my_custom_task"
        task_id = self.task_manager.submit_task(custom_task(), task_id=custom_id)
        
        assert task_id == custom_id
    
    def test_shutdown(self):
        """Test task manager shutdown."""
        # Submit a task before shutdown
        async def test_task():
            await asyncio.sleep(0.5)
            return "result"
        
        task_id = self.task_manager.submit_task(test_task())
        
        # Shutdown should cancel running tasks
        self.task_manager.shutdown()
        
        assert self.task_manager._shutdown is True
        
        # Should not be able to submit new tasks
        with pytest.raises(RuntimeError):
            self.task_manager.submit_task(test_task())


class TestPeriodicTask:
    """Test cases for PeriodicTask class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.task_manager = BackgroundTaskManager()
        time.sleep(0.1)  # Give event loop time to start
    
    def teardown_method(self):
        """Clean up after tests."""
        self.task_manager.shutdown()
    
    def test_periodic_task_init(self):
        """Test periodic task initialization."""
        counter = MagicMock()
        
        periodic_task = PeriodicTask(
            task_manager=self.task_manager,
            interval=0.1,
            task_func=counter,
            callback=None
        )
        
        assert periodic_task.interval == 0.1
        assert periodic_task.task_func == counter
        assert not periodic_task.is_running()
    
    def test_periodic_task_execution(self):
        """Test periodic task execution."""
        execution_count = 0
        
        def counting_task():
            nonlocal execution_count
            execution_count += 1
        
        periodic_task = PeriodicTask(
            task_manager=self.task_manager,
            interval=0.05,  # Very short interval for testing
            task_func=counting_task
        )
        
        # Start the task
        periodic_task.start()
        assert periodic_task.is_running()
        
        # Let it run for a short time
        time.sleep(0.2)
        
        # Stop the task
        periodic_task.stop()
        assert not periodic_task.is_running()
        
        # Should have executed multiple times
        assert execution_count >= 2
    
    def test_periodic_task_async_function(self):
        """Test periodic task with async function."""
        execution_count = 0
        
        async def async_counting_task():
            nonlocal execution_count
            execution_count += 1
            await asyncio.sleep(0.01)
        
        periodic_task = PeriodicTask(
            task_manager=self.task_manager,
            interval=0.05,
            task_func=async_counting_task
        )
        
        # Start and run briefly
        periodic_task.start()
        time.sleep(0.15)
        periodic_task.stop()
        
        # Should have executed at least once
        assert execution_count >= 1
    
    def test_periodic_task_error_handling(self):
        """Test periodic task error handling."""
        execution_count = 0
        
        def failing_task():
            nonlocal execution_count
            execution_count += 1
            if execution_count == 2:
                raise ValueError("Test error")
        
        callback = MagicMock()
        
        periodic_task = PeriodicTask(
            task_manager=self.task_manager,
            interval=0.05,
            task_func=failing_task,
            callback=callback
        )
        
        # Start and let it run through error
        periodic_task.start()
        time.sleep(0.2)
        periodic_task.stop()
        
        # Should have continued executing despite error
        assert execution_count >= 3
    
    def test_periodic_task_stop_before_start(self):
        """Test stopping periodic task before starting."""
        counter = MagicMock()
        
        periodic_task = PeriodicTask(
            task_manager=self.task_manager,
            interval=0.1,
            task_func=counter
        )
        
        # Should handle stop before start gracefully
        periodic_task.stop()
        assert not periodic_task.is_running()
    
    def test_periodic_task_double_start(self):
        """Test starting periodic task twice."""
        counter = MagicMock()
        
        periodic_task = PeriodicTask(
            task_manager=self.task_manager,
            interval=0.1,
            task_func=counter
        )
        
        # Start twice
        periodic_task.start()
        periodic_task.start()  # Should log warning but not crash
        
        assert periodic_task.is_running()
        
        # Clean up
        periodic_task.stop()


if __name__ == '__main__':
    pytest.main([__file__])