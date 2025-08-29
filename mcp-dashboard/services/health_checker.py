"""
Service health monitoring system with real-time status updates.
Implements periodic health checks with configurable intervals and notifications.
"""
import asyncio
import time
import logging
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from .http_client import HttpClient, RequestResult
from config.service_config import ServiceConfig


class HealthStatus(Enum):
    """Health status enumeration."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"
    CHECKING = "checking"


@dataclass
class ServiceHealthInfo:
    """Detailed health information for a service."""
    service_name: str
    status: HealthStatus
    last_check: datetime
    response_time: Optional[float] = None
    error_details: Optional[str] = None
    consecutive_failures: int = 0
    consecutive_successes: int = 0
    total_checks: int = 0
    uptime_percentage: float = 0.0
    
    def __post_init__(self):
        """Initialize computed fields."""
        if self.last_check is None:
            self.last_check = datetime.now()
    
    @property
    def is_healthy(self) -> bool:
        """Check if service is healthy."""
        return self.status == HealthStatus.HEALTHY
    
    def update_success(self, response_time: float):
        """Update health info after successful check."""
        self.status = HealthStatus.HEALTHY
        self.last_check = datetime.now()
        self.response_time = response_time
        self.error_details = None
        self.consecutive_failures = 0
        self.consecutive_successes += 1
        self.total_checks += 1
        self._update_uptime()
    
    def update_failure(self, error_message: str):
        """Update health info after failed check."""
        self.status = HealthStatus.UNHEALTHY
        self.last_check = datetime.now()
        self.response_time = None
        self.error_details = error_message
        self.consecutive_successes = 0
        self.consecutive_failures += 1
        self.total_checks += 1
        self._update_uptime()
    
    def _update_uptime(self):
        """Update uptime percentage based on recent checks."""
        if self.total_checks > 0:
            successful_checks = self.total_checks - self.consecutive_failures
            if self.consecutive_failures == 0:
                # If no current failures, count all checks as successful
                successful_checks = self.total_checks
            else:
                # If there are consecutive failures, subtract them from total
                successful_checks = max(0, self.total_checks - self.consecutive_failures)
            
            self.uptime_percentage = (successful_checks / self.total_checks) * 100


class HealthChecker:
    """
    Service health monitoring system.
    
    Performs periodic health checks on configured services and provides
    real-time status updates through callback notifications.
    """
    
    def __init__(self, services: List[ServiceConfig], check_interval: int = 30):
        """
        Initialize health checker.
        
        Args:
            services: List of service configurations to monitor
            check_interval: Interval between health checks in seconds
        """
        self.services = services
        self.check_interval = check_interval
        self.logger = logging.getLogger("HealthChecker")
        
        # Health status tracking
        self.health_info: Dict[str, ServiceHealthInfo] = {}
        self.http_clients: Dict[str, HttpClient] = {}
        
        # Monitoring control
        self._monitoring_task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._callbacks: List[Callable[[str, ServiceHealthInfo], None]] = []
        
        # Initialize health info for all services
        self._initialize_health_info()
    
    def _initialize_health_info(self):
        """Initialize health information for all services."""
        for service in self.services:
            self.health_info[service.name] = ServiceHealthInfo(
                service_name=service.name,
                status=HealthStatus.UNKNOWN,
                last_check=datetime.now()
            )
            self.http_clients[service.name] = HttpClient(service)
    
    def add_status_callback(self, callback: Callable[[str, ServiceHealthInfo], None]):
        """
        Add callback for health status changes.
        
        Args:
            callback: Function to call when health status changes
        """
        self._callbacks.append(callback)
    
    def remove_status_callback(self, callback: Callable[[str, ServiceHealthInfo], None]):
        """
        Remove status change callback.
        
        Args:
            callback: Callback function to remove
        """
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    def _notify_status_change(self, service_name: str, health_info: ServiceHealthInfo):
        """Notify all callbacks of status change."""
        for callback in self._callbacks:
            try:
                callback(service_name, health_info)
            except Exception as e:
                self.logger.error(f"Error in status callback: {e}")
    
    async def check_service_health(self, service: ServiceConfig) -> ServiceHealthInfo:
        """
        Check health of a specific service.
        
        Args:
            service: Service configuration to check
            
        Returns:
            ServiceHealthInfo with current health status
        """
        service_name = service.name
        health_info = self.health_info.get(service_name)
        
        if not health_info:
            health_info = ServiceHealthInfo(
                service_name=service_name,
                status=HealthStatus.UNKNOWN,
                last_check=datetime.now()
            )
            self.health_info[service_name] = health_info
        
        # Update status to checking
        previous_status = health_info.status
        health_info.status = HealthStatus.CHECKING
        
        try:
            # Use the HTTP client to check health
            http_client = self.http_clients.get(service_name)
            if not http_client:
                http_client = HttpClient(service)
                self.http_clients[service_name] = http_client
            
            # Try to make a health check request
            health_endpoint = self._get_health_endpoint(service)
            
            async with http_client:
                result = await http_client.make_request('GET', health_endpoint)
                
                if result.success and result.status_code < 400:
                    health_info.update_success(result.response_time)
                    self.logger.info(f"Service {service_name} is healthy (response time: {result.response_time:.2f}ms)")
                else:
                    error_msg = result.error_message or f"HTTP {result.status_code}"
                    health_info.update_failure(error_msg)
                    self.logger.warning(f"Service {service_name} health check failed: {error_msg}")
        
        except Exception as e:
            error_msg = f"Health check error: {str(e)}"
            health_info.update_failure(error_msg)
            self.logger.error(f"Service {service_name} health check exception: {e}")
        
        # Notify callbacks if status changed
        if health_info.status != previous_status:
            self._notify_status_change(service_name, health_info)
        
        return health_info
    
    def _get_health_endpoint(self, service: ServiceConfig) -> str:
        """
        Get health check endpoint for a service.
        
        Args:
            service: Service configuration
            
        Returns:
            Health check endpoint path
        """
        # Try common health check endpoints
        common_health_endpoints = ['/health', '/status', '/ping', '/actuator/health']
        
        # Check if service has specific health endpoint in sample endpoints
        for endpoint in service.sample_endpoints:
            endpoint_lower = endpoint.lower()
            if any(health_path in endpoint_lower for health_path in ['health', 'status', 'ping']):
                # Extract the path from "GET /health" format
                parts = endpoint.split(' ')
                if len(parts) >= 2:
                    return parts[1]
        
        # Default to /health
        return '/health'
    
    async def check_all_services(self) -> Dict[str, ServiceHealthInfo]:
        """
        Check health of all configured services.
        
        Returns:
            Dictionary mapping service names to health information
        """
        tasks = []
        for service in self.services:
            task = asyncio.create_task(self.check_service_health(service))
            tasks.append(task)
        
        # Wait for all health checks to complete
        await asyncio.gather(*tasks, return_exceptions=True)
        
        return self.health_info.copy()
    
    def get_service_health(self, service_name: str) -> Optional[ServiceHealthInfo]:
        """
        Get current health information for a service.
        
        Args:
            service_name: Name of the service
            
        Returns:
            ServiceHealthInfo if service exists, None otherwise
        """
        return self.health_info.get(service_name)
    
    def get_all_health_info(self) -> Dict[str, ServiceHealthInfo]:
        """
        Get health information for all services.
        
        Returns:
            Dictionary mapping service names to health information
        """
        return self.health_info.copy()
    
    def get_healthy_services(self) -> List[str]:
        """
        Get list of healthy service names.
        
        Returns:
            List of service names that are currently healthy
        """
        return [
            name for name, info in self.health_info.items()
            if info.is_healthy
        ]
    
    def get_unhealthy_services(self) -> List[str]:
        """
        Get list of unhealthy service names.
        
        Returns:
            List of service names that are currently unhealthy
        """
        return [
            name for name, info in self.health_info.items()
            if info.status == HealthStatus.UNHEALTHY
        ]
    
    async def start_monitoring(self):
        """Start periodic health monitoring."""
        if self._monitoring_task and not self._monitoring_task.done():
            self.logger.warning("Health monitoring is already running")
            return
        
        self.logger.info(f"Starting health monitoring with {self.check_interval}s interval")
        self._stop_event.clear()
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())
    
    async def stop_monitoring(self):
        """Stop periodic health monitoring."""
        if not self._monitoring_task or self._monitoring_task.done():
            self.logger.warning("Health monitoring is not running")
            return
        
        self.logger.info("Stopping health monitoring")
        self._stop_event.set()
        
        try:
            await asyncio.wait_for(self._monitoring_task, timeout=5.0)
        except asyncio.TimeoutError:
            self.logger.warning("Health monitoring task did not stop gracefully, cancelling")
            self._monitoring_task.cancel()
        
        # Close all HTTP clients
        for client in self.http_clients.values():
            await client.close()
    
    async def _monitoring_loop(self):
        """Main monitoring loop that runs periodic health checks."""
        try:
            # Perform initial health check
            await self.check_all_services()
            
            while not self._stop_event.is_set():
                try:
                    # Wait for the check interval or stop event
                    await asyncio.wait_for(
                        self._stop_event.wait(),
                        timeout=self.check_interval
                    )
                    # If we get here, stop event was set
                    break
                except asyncio.TimeoutError:
                    # Timeout is expected, continue with health check
                    pass
                
                # Perform health checks
                self.logger.debug("Performing periodic health checks")
                await self.check_all_services()
        
        except asyncio.CancelledError:
            self.logger.info("Health monitoring loop cancelled")
            raise
        except Exception as e:
            self.logger.error(f"Error in health monitoring loop: {e}")
        finally:
            self.logger.info("Health monitoring loop stopped")
    
    def is_monitoring(self) -> bool:
        """
        Check if health monitoring is currently active.
        
        Returns:
            True if monitoring is active, False otherwise
        """
        return self._monitoring_task is not None and not self._monitoring_task.done()
    
    async def force_check(self, service_name: Optional[str] = None):
        """
        Force an immediate health check.
        
        Args:
            service_name: Specific service to check, or None for all services
        """
        if service_name:
            service = next((s for s in self.services if s.name == service_name), None)
            if service:
                await self.check_service_health(service)
            else:
                self.logger.warning(f"Service {service_name} not found for health check")
        else:
            await self.check_all_services()