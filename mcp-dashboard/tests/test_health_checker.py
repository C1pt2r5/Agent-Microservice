"""
Unit tests for health monitoring system.
"""
import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from services.health_checker import HealthChecker, ServiceHealthInfo, HealthStatus
from services.http_client import RequestResult
from config.service_config import ServiceConfig, AuthType, CircuitBreakerConfig


class TestServiceHealthInfo:
    """Test cases for ServiceHealthInfo class."""
    
    def test_health_info_init(self):
        """Test health info initialization."""
        health_info = ServiceHealthInfo(
            service_name="test-service",
            status=HealthStatus.UNKNOWN,
            last_check=datetime.now()
        )
        
        assert health_info.service_name == "test-service"
        assert health_info.status == HealthStatus.UNKNOWN
        assert health_info.consecutive_failures == 0
        assert health_info.consecutive_successes == 0
        assert health_info.total_checks == 0
        assert health_info.uptime_percentage == 0.0
    
    def test_is_healthy_property(self):
        """Test is_healthy property."""
        health_info = ServiceHealthInfo(
            service_name="test-service",
            status=HealthStatus.HEALTHY,
            last_check=datetime.now()
        )
        assert health_info.is_healthy is True
        
        health_info.status = HealthStatus.UNHEALTHY
        assert health_info.is_healthy is False
        
        health_info.status = HealthStatus.UNKNOWN
        assert health_info.is_healthy is False
    
    def test_update_success(self):
        """Test updating health info after successful check."""
        health_info = ServiceHealthInfo(
            service_name="test-service",
            status=HealthStatus.UNKNOWN,
            last_check=datetime.now()
        )
        
        health_info.update_success(150.5)
        
        assert health_info.status == HealthStatus.HEALTHY
        assert health_info.response_time == 150.5
        assert health_info.error_details is None
        assert health_info.consecutive_failures == 0
        assert health_info.consecutive_successes == 1
        assert health_info.total_checks == 1
        assert health_info.uptime_percentage == 100.0
    
    def test_update_failure(self):
        """Test updating health info after failed check."""
        health_info = ServiceHealthInfo(
            service_name="test-service",
            status=HealthStatus.HEALTHY,
            last_check=datetime.now()
        )
        
        health_info.update_failure("Connection refused")
        
        assert health_info.status == HealthStatus.UNHEALTHY
        assert health_info.response_time is None
        assert health_info.error_details == "Connection refused"
        assert health_info.consecutive_successes == 0
        assert health_info.consecutive_failures == 1
        assert health_info.total_checks == 1
        assert health_info.uptime_percentage == 0.0
    
    def test_uptime_calculation(self):
        """Test uptime percentage calculation."""
        health_info = ServiceHealthInfo(
            service_name="test-service",
            status=HealthStatus.UNKNOWN,
            last_check=datetime.now()
        )
        
        # 3 successes, 2 failures
        health_info.update_success(100)
        health_info.update_success(120)
        health_info.update_success(110)
        health_info.update_failure("Error 1")
        health_info.update_failure("Error 2")
        
        # Should be 60% uptime (3 successes out of 5 total)
        assert health_info.uptime_percentage == 60.0
        assert health_info.consecutive_failures == 2
        assert health_info.total_checks == 5


class TestHealthChecker:
    """Test cases for HealthChecker class."""
    
    def create_test_service_config(self, name: str = "test-service", **overrides):
        """Create a test service configuration."""
        defaults = {
            'name': name,
            'endpoint': 'http://localhost:8080/api',
            'auth_type': AuthType.NONE,
            'timeout': 5000,
            'circuit_breaker': CircuitBreakerConfig(),
            'sample_endpoints': ['GET /health', 'GET /users']
        }
        defaults.update(overrides)
        return ServiceConfig(**defaults)
    
    def test_health_checker_init(self):
        """Test health checker initialization."""
        services = [
            self.create_test_service_config("service1"),
            self.create_test_service_config("service2")
        ]
        
        checker = HealthChecker(services, check_interval=60)
        
        assert len(checker.services) == 2
        assert checker.check_interval == 60
        assert len(checker.health_info) == 2
        assert len(checker.http_clients) == 2
        assert "service1" in checker.health_info
        assert "service2" in checker.health_info
    
    def test_add_remove_callbacks(self):
        """Test adding and removing status callbacks."""
        services = [self.create_test_service_config()]
        checker = HealthChecker(services)
        
        callback1 = MagicMock()
        callback2 = MagicMock()
        
        checker.add_status_callback(callback1)
        checker.add_status_callback(callback2)
        assert len(checker._callbacks) == 2
        
        checker.remove_status_callback(callback1)
        assert len(checker._callbacks) == 1
        assert callback2 in checker._callbacks
    
    def test_get_health_endpoint(self):
        """Test health endpoint detection."""
        services = [self.create_test_service_config()]
        checker = HealthChecker(services)
        
        # Test with health endpoint in sample endpoints
        service_with_health = self.create_test_service_config(
            sample_endpoints=['GET /health', 'GET /users']
        )
        endpoint = checker._get_health_endpoint(service_with_health)
        assert endpoint == '/health'
        
        # Test with status endpoint
        service_with_status = self.create_test_service_config(
            sample_endpoints=['GET /status', 'GET /products']
        )
        endpoint = checker._get_health_endpoint(service_with_status)
        assert endpoint == '/status'
        
        # Test with no health endpoint (should default to /health)
        service_no_health = self.create_test_service_config(
            sample_endpoints=['GET /users', 'GET /products']
        )
        endpoint = checker._get_health_endpoint(service_no_health)
        assert endpoint == '/health'
    
    @pytest.mark.asyncio
    async def test_check_service_health_success(self):
        """Test successful service health check."""
        services = [self.create_test_service_config()]
        checker = HealthChecker(services)
        
        # Mock successful HTTP response
        mock_result = RequestResult(
            success=True,
            status_code=200,
            response_data={'status': 'healthy'},
            response_time=150.0
        )
        
        with patch.object(checker.http_clients['test-service'], 'make_request', return_value=mock_result):
            health_info = await checker.check_service_health(services[0])
            
            assert health_info.status == HealthStatus.HEALTHY
            assert health_info.response_time == 150.0
            assert health_info.error_details is None
            assert health_info.consecutive_successes == 1
    
    @pytest.mark.asyncio
    async def test_check_service_health_failure(self):
        """Test failed service health check."""
        services = [self.create_test_service_config()]
        checker = HealthChecker(services)
        
        # Mock failed HTTP response
        mock_result = RequestResult(
            success=False,
            status_code=500,
            response_data={},
            response_time=0,
            error_message="Internal Server Error"
        )
        
        with patch.object(checker.http_clients['test-service'], 'make_request', return_value=mock_result):
            health_info = await checker.check_service_health(services[0])
            
            assert health_info.status == HealthStatus.UNHEALTHY
            assert health_info.response_time is None
            assert "Internal Server Error" in health_info.error_details
            assert health_info.consecutive_failures == 1
    
    @pytest.mark.asyncio
    async def test_check_service_health_exception(self):
        """Test service health check with exception."""
        services = [self.create_test_service_config()]
        checker = HealthChecker(services)
        
        # Mock exception during HTTP request
        with patch.object(checker.http_clients['test-service'], 'make_request', side_effect=Exception("Connection timeout")):
            health_info = await checker.check_service_health(services[0])
            
            assert health_info.status == HealthStatus.UNHEALTHY
            assert health_info.response_time is None
            assert "Connection timeout" in health_info.error_details
            assert health_info.consecutive_failures == 1
    
    @pytest.mark.asyncio
    async def test_check_all_services(self):
        """Test checking health of all services."""
        services = [
            self.create_test_service_config("service1"),
            self.create_test_service_config("service2")
        ]
        checker = HealthChecker(services)
        
        # Mock successful responses for both services
        mock_result = RequestResult(
            success=True,
            status_code=200,
            response_data={'status': 'healthy'},
            response_time=100.0
        )
        
        with patch.object(checker, 'check_service_health', return_value=ServiceHealthInfo(
            service_name="test",
            status=HealthStatus.HEALTHY,
            last_check=datetime.now()
        )):
            health_info = await checker.check_all_services()
            
            assert len(health_info) == 2
            assert "service1" in health_info
            assert "service2" in health_info
    
    def test_get_service_health(self):
        """Test getting health info for specific service."""
        services = [self.create_test_service_config()]
        checker = HealthChecker(services)
        
        health_info = checker.get_service_health("test-service")
        assert health_info is not None
        assert health_info.service_name == "test-service"
        
        # Test non-existent service
        health_info = checker.get_service_health("non-existent")
        assert health_info is None
    
    def test_get_healthy_unhealthy_services(self):
        """Test getting lists of healthy and unhealthy services."""
        services = [
            self.create_test_service_config("service1"),
            self.create_test_service_config("service2"),
            self.create_test_service_config("service3")
        ]
        checker = HealthChecker(services)
        
        # Set different health statuses
        checker.health_info["service1"].status = HealthStatus.HEALTHY
        checker.health_info["service2"].status = HealthStatus.UNHEALTHY
        checker.health_info["service3"].status = HealthStatus.UNKNOWN
        
        healthy = checker.get_healthy_services()
        unhealthy = checker.get_unhealthy_services()
        
        assert healthy == ["service1"]
        assert unhealthy == ["service2"]
    
    @pytest.mark.asyncio
    async def test_status_change_notification(self):
        """Test status change notifications."""
        services = [self.create_test_service_config()]
        checker = HealthChecker(services)
        
        callback = MagicMock()
        checker.add_status_callback(callback)
        
        # Mock a status change from UNKNOWN to HEALTHY
        mock_result = RequestResult(
            success=True,
            status_code=200,
            response_data={'status': 'healthy'},
            response_time=100.0
        )
        
        with patch.object(checker.http_clients['test-service'], 'make_request', return_value=mock_result):
            await checker.check_service_health(services[0])
            
            # Callback should be called once for status change
            callback.assert_called_once()
            args = callback.call_args[0]
            assert args[0] == "test-service"  # service name
            assert args[1].status == HealthStatus.HEALTHY  # health info
    
    @pytest.mark.asyncio
    async def test_monitoring_lifecycle(self):
        """Test starting and stopping monitoring."""
        services = [self.create_test_service_config()]
        checker = HealthChecker(services, check_interval=0.1)  # Short interval for testing
        
        assert not checker.is_monitoring()
        
        # Start monitoring
        await checker.start_monitoring()
        assert checker.is_monitoring()
        
        # Let it run for a short time
        await asyncio.sleep(0.2)
        
        # Stop monitoring
        await checker.stop_monitoring()
        assert not checker.is_monitoring()
    
    @pytest.mark.asyncio
    async def test_force_check(self):
        """Test forcing immediate health check."""
        services = [
            self.create_test_service_config("service1"),
            self.create_test_service_config("service2")
        ]
        checker = HealthChecker(services)
        
        # Mock successful response
        mock_result = RequestResult(
            success=True,
            status_code=200,
            response_data={'status': 'healthy'},
            response_time=100.0
        )
        
        with patch.object(checker, 'check_service_health', return_value=ServiceHealthInfo(
            service_name="service1",
            status=HealthStatus.HEALTHY,
            last_check=datetime.now()
        )) as mock_check:
            # Force check specific service
            await checker.force_check("service1")
            mock_check.assert_called_once()
        
        with patch.object(checker, 'check_all_services') as mock_check_all:
            # Force check all services
            await checker.force_check()
            mock_check_all.assert_called_once()


if __name__ == '__main__':
    pytest.main([__file__])