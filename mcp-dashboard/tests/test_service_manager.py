"""
Unit tests for service management functionality.
Tests dynamic service discovery, request execution coordination, and sample endpoint management.
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any

from services.service_manager import ServiceManager, EndpointInfo, ServiceExecutionResult
from services.http_client import RequestResult
from services.health_checker import ServiceHealthInfo, HealthStatus
from config.env_loader import EnvLoader
from config.service_config import (
    ServiceConfig, GatewayConfig, ConfigurationData, ValidationError,
    AuthType, RetryConfig, CircuitBreakerConfig
)


class TestServiceManager:
    """Test cases for ServiceManager class."""
    
    @pytest.fixture
    def mock_config_loader(self):
        """Create mock configuration loader."""
        loader = Mock(spec=EnvLoader)
        return loader
    
    @pytest.fixture
    def sample_service_config(self):
        """Create sample service configuration."""
        return ServiceConfig(
            name="user-service",
            endpoint="http://localhost:8081",
            auth_type=AuthType.NONE,
            timeout=30000,
            sample_endpoints=[
                "GET /users",
                "GET /users/{id}",
                "POST /users",
                "PUT /users/{id}",
                "DELETE /users/{id}"
            ]
        )
    
    @pytest.fixture
    def sample_config_data(self, sample_service_config):
        """Create sample configuration data."""
        return ConfigurationData(
            gateway=GatewayConfig(
                url="http://localhost:8080",
                port=8080,
                default_timeout=30000
            ),
            services=[sample_service_config],
            validation_errors=[]
        )
    
    @pytest.fixture
    def service_manager(self, mock_config_loader):
        """Create service manager instance."""
        return ServiceManager(mock_config_loader)
    
    @pytest.mark.asyncio
    async def test_initialize_success(self, service_manager, mock_config_loader, sample_config_data):
        """Test successful service manager initialization."""
        # Setup
        mock_config_loader.load_config.return_value = sample_config_data
        
        # Execute
        result = await service_manager.initialize("/path/to/env")
        
        # Verify
        assert result is True
        assert len(service_manager.get_available_services()) == 1
        assert "user-service" in service_manager.get_service_names()
        mock_config_loader.load_config.assert_called_once_with("/path/to/env")
    
    @pytest.mark.asyncio
    async def test_initialize_with_validation_errors(self, service_manager, mock_config_loader):
        """Test initialization with configuration validation errors."""
        # Setup
        config_data = ConfigurationData(
            gateway=GatewayConfig(),
            services=[],
            validation_errors=[ValidationError("test", "Test error")]
        )
        mock_config_loader.load_config.return_value = config_data
        
        # Execute
        result = await service_manager.initialize("/path/to/env")
        
        # Verify
        assert result is False
        assert len(service_manager.get_available_services()) == 0
    
    @pytest.mark.asyncio
    async def test_initialize_exception_handling(self, service_manager, mock_config_loader):
        """Test initialization exception handling."""
        # Setup
        mock_config_loader.load_config.side_effect = Exception("Config load error")
        
        # Execute
        result = await service_manager.initialize("/path/to/env")
        
        # Verify
        assert result is False
    
    def test_get_available_services(self, service_manager, sample_service_config):
        """Test getting available services."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        
        # Execute
        services = service_manager.get_available_services()
        
        # Verify
        assert len(services) == 1
        assert services[0].name == "user-service"
    
    def test_get_service_names(self, service_manager, sample_service_config):
        """Test getting service names."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        
        # Execute
        names = service_manager.get_service_names()
        
        # Verify
        assert names == ["user-service"]
    
    def test_get_service_config(self, service_manager, sample_service_config):
        """Test getting specific service configuration."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        
        # Execute
        config = service_manager.get_service_config("user-service")
        missing_config = service_manager.get_service_config("missing-service")
        
        # Verify
        assert config == sample_service_config
        assert missing_config is None
    
    @pytest.mark.asyncio
    async def test_execute_request_success(self, service_manager, sample_service_config):
        """Test successful request execution."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        
        mock_http_client = AsyncMock()
        mock_result = RequestResult(
            success=True,
            status_code=200,
            response_data={"users": []},
            response_time=150.0
        )
        mock_http_client.make_request.return_value = mock_result
        service_manager._http_clients = {"user-service": mock_http_client}
        
        # Execute
        result = await service_manager.execute_request("user-service", "/users", "GET")
        
        # Verify
        assert isinstance(result, ServiceExecutionResult)
        assert result.success is True
        assert result.service_name == "user-service"
        assert result.endpoint == "/users"
        assert result.method == "GET"
        assert result.status_code == 200
        assert result.response_data == {"users": []}
        mock_http_client.make_request.assert_called_once_with("GET", "/users")
    
    @pytest.mark.asyncio
    async def test_execute_request_service_not_found(self, service_manager):
        """Test request execution with non-existent service."""
        # Execute
        result = await service_manager.execute_request("missing-service", "/test", "GET")
        
        # Verify
        assert isinstance(result, ServiceExecutionResult)
        assert result.success is False
        assert result.status_code == 404
        assert "not found" in result.error_message.lower()
    
    @pytest.mark.asyncio
    async def test_execute_request_http_client_exception(self, service_manager, sample_service_config):
        """Test request execution with HTTP client exception."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        
        mock_http_client = AsyncMock()
        mock_http_client.make_request.side_effect = Exception("Network error")
        service_manager._http_clients = {"user-service": mock_http_client}
        
        # Execute
        result = await service_manager.execute_request("user-service", "/users", "GET")
        
        # Verify
        assert isinstance(result, ServiceExecutionResult)
        assert result.success is False
        assert result.status_code == 500
        assert "Network error" in result.error_message
    
    def test_get_sample_endpoints_cached(self, service_manager, sample_service_config):
        """Test getting sample endpoints from cache."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        cached_endpoints = [
            EndpointInfo("GET", "/users", "Get all users"),
            EndpointInfo("POST", "/users", "Create new user")
        ]
        service_manager._sample_endpoints_cache = {"user-service": cached_endpoints}
        
        # Execute
        endpoints = service_manager.get_sample_endpoints("user-service")
        
        # Verify
        assert endpoints == cached_endpoints
    
    def test_get_sample_endpoints_from_config(self, service_manager, sample_service_config):
        """Test getting sample endpoints from service configuration."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        
        # Execute
        endpoints = service_manager.get_sample_endpoints("user-service")
        
        # Verify
        assert len(endpoints) == 5
        assert all(isinstance(ep, EndpointInfo) for ep in endpoints)
        assert endpoints[0].method == "GET"
        assert endpoints[0].path == "/users"
        assert endpoints[2].method == "POST"
        assert endpoints[2].path == "/users"
        
        # Check cache was populated
        assert "user-service" in service_manager._sample_endpoints_cache
    
    def test_get_sample_endpoints_service_not_found(self, service_manager):
        """Test getting sample endpoints for non-existent service."""
        # Execute
        endpoints = service_manager.get_sample_endpoints("missing-service")
        
        # Verify
        assert endpoints == []
    
    def test_parse_endpoint_string_valid(self, service_manager):
        """Test parsing valid endpoint strings."""
        # Execute
        endpoint_info = service_manager._parse_endpoint_string("GET /users", "user-service")
        
        # Verify
        assert endpoint_info is not None
        assert endpoint_info.method == "GET"
        assert endpoint_info.path == "/users"
        assert endpoint_info.description == "Get all users"
        assert endpoint_info.sample_payload is None
    
    def test_parse_endpoint_string_with_payload(self, service_manager):
        """Test parsing endpoint string that should have payload."""
        # Execute
        endpoint_info = service_manager._parse_endpoint_string("POST /users", "user-service")
        
        # Verify
        assert endpoint_info is not None
        assert endpoint_info.method == "POST"
        assert endpoint_info.path == "/users"
        assert endpoint_info.sample_payload is not None
        assert "name" in endpoint_info.sample_payload
        assert "email" in endpoint_info.sample_payload
    
    def test_parse_endpoint_string_invalid_format(self, service_manager):
        """Test parsing invalid endpoint string format."""
        # Execute
        endpoint_info = service_manager._parse_endpoint_string("invalid-format", "user-service")
        
        # Verify
        assert endpoint_info is None
    
    def test_generate_endpoint_description(self, service_manager):
        """Test endpoint description generation."""
        # Test various methods and paths
        test_cases = [
            ("GET", "/users", "user-service", "Get all users"),
            ("GET", "/users/{id}", "user-service", "Get specific users by ID"),
            ("POST", "/products", "product-service", "Create new products"),
            ("PUT", "/transactions/{id}", "transaction-service", "Update transactions"),
            ("DELETE", "/users/{id}", "user-service", "Delete users")
        ]
        
        for method, path, service, expected in test_cases:
            description = service_manager._generate_endpoint_description(method, path, service)
            assert expected.lower() in description.lower()
    
    def test_generate_sample_payload_user_service(self, service_manager):
        """Test sample payload generation for user service."""
        # Execute
        payload = service_manager._generate_sample_payload("/users", "user-service")
        
        # Verify
        assert payload is not None
        assert "name" in payload
        assert "email" in payload
        assert "age" in payload
    
    def test_generate_sample_payload_transaction_service(self, service_manager):
        """Test sample payload generation for transaction service."""
        # Execute
        payload = service_manager._generate_sample_payload("/transactions", "transaction-service")
        
        # Verify
        assert payload is not None
        assert "amount" in payload
        assert "currency" in payload
        assert "userId" in payload
    
    def test_generate_sample_payload_product_service(self, service_manager):
        """Test sample payload generation for product service."""
        # Execute
        payload = service_manager._generate_sample_payload("/products", "product-service")
        
        # Verify
        assert payload is not None
        assert "name" in payload
        assert "price" in payload
        assert "category" in payload
    
    def test_generate_sample_payload_generic_service(self, service_manager):
        """Test sample payload generation for generic service."""
        # Execute
        payload = service_manager._generate_sample_payload("/api/test", "generic-service")
        
        # Verify
        assert payload is not None
        assert "data" in payload
        assert "timestamp" in payload
    
    @pytest.mark.asyncio
    async def test_execute_sample_endpoint_get(self, service_manager, sample_service_config):
        """Test executing sample GET endpoint."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        
        mock_http_client = AsyncMock()
        mock_result = RequestResult(
            success=True,
            status_code=200,
            response_data={"users": []},
            response_time=100.0
        )
        mock_http_client.make_request.return_value = mock_result
        service_manager._http_clients = {"user-service": mock_http_client}
        
        endpoint_info = EndpointInfo(
            path="/users",
            method="GET",
            description="Get all users"
        )
        
        # Execute
        result = await service_manager.execute_sample_endpoint("user-service", endpoint_info)
        
        # Verify
        assert result.success is True
        mock_http_client.make_request.assert_called_once_with("GET", "/users")
    
    @pytest.mark.asyncio
    async def test_execute_sample_endpoint_post_with_payload(self, service_manager, sample_service_config):
        """Test executing sample POST endpoint with payload."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        
        mock_http_client = AsyncMock()
        mock_result = RequestResult(
            success=True,
            status_code=201,
            response_data={"id": 1, "name": "John Doe"},
            response_time=200.0
        )
        mock_http_client.make_request.return_value = mock_result
        service_manager._http_clients = {"user-service": mock_http_client}
        
        endpoint_info = EndpointInfo(
            path="/users",
            method="POST",
            description="Create new user",
            sample_payload={"name": "John Doe", "email": "john@example.com"}
        )
        
        # Execute
        result = await service_manager.execute_sample_endpoint("user-service", endpoint_info)
        
        # Verify
        assert result.success is True
        mock_http_client.make_request.assert_called_once_with(
            "POST", 
            "/users",
            json={"name": "John Doe", "email": "john@example.com"},
            headers={"Content-Type": "application/json"}
        )
    
    def test_get_service_health_with_health_checker(self, service_manager):
        """Test getting service health with health checker available."""
        # Setup
        mock_health_checker = Mock()
        mock_health_info = ServiceHealthInfo(
            service_name="user-service",
            status=HealthStatus.HEALTHY,
            last_check=datetime.now(),
            response_time=100.0
        )
        mock_health_checker.get_service_health.return_value = mock_health_info
        service_manager._health_checker = mock_health_checker
        
        # Execute
        health_info = service_manager.get_service_health("user-service")
        
        # Verify
        assert health_info == mock_health_info
        mock_health_checker.get_service_health.assert_called_once_with("user-service")
    
    def test_get_service_health_without_health_checker(self, service_manager):
        """Test getting service health without health checker."""
        # Execute
        health_info = service_manager.get_service_health("user-service")
        
        # Verify
        assert health_info is None
    
    def test_get_all_health_info(self, service_manager):
        """Test getting all health information."""
        # Setup
        mock_health_checker = Mock()
        mock_health_data = {
            "user-service": ServiceHealthInfo("user-service", HealthStatus.HEALTHY, datetime.now()),
            "product-service": ServiceHealthInfo("product-service", HealthStatus.UNHEALTHY, datetime.now())
        }
        mock_health_checker.get_all_health_info.return_value = mock_health_data
        service_manager._health_checker = mock_health_checker
        
        # Execute
        health_info = service_manager.get_all_health_info()
        
        # Verify
        assert health_info == mock_health_data
    
    def test_add_health_status_callback(self, service_manager):
        """Test adding health status callback."""
        # Setup
        mock_health_checker = Mock()
        service_manager._health_checker = mock_health_checker
        callback = Mock()
        
        # Execute
        service_manager.add_health_status_callback(callback)
        
        # Verify
        assert callback in service_manager._status_callbacks
        mock_health_checker.add_status_callback.assert_called_once_with(callback)
    
    def test_remove_health_status_callback(self, service_manager):
        """Test removing health status callback."""
        # Setup
        mock_health_checker = Mock()
        service_manager._health_checker = mock_health_checker
        callback = Mock()
        service_manager._status_callbacks.append(callback)
        
        # Execute
        service_manager.remove_health_status_callback(callback)
        
        # Verify
        assert callback not in service_manager._status_callbacks
        mock_health_checker.remove_status_callback.assert_called_once_with(callback)
    
    @pytest.mark.asyncio
    async def test_force_health_check(self, service_manager):
        """Test forcing health check."""
        # Setup
        mock_health_checker = AsyncMock()
        service_manager._health_checker = mock_health_checker
        
        # Execute
        await service_manager.force_health_check("user-service")
        
        # Verify
        mock_health_checker.force_check.assert_called_once_with("user-service")
    
    def test_get_configuration_errors(self, service_manager, sample_config_data):
        """Test getting configuration errors."""
        # Setup
        validation_errors = [ValidationError("test", "Test error")]
        sample_config_data.validation_errors = validation_errors
        service_manager._config_data = sample_config_data
        
        # Execute
        errors = service_manager.get_configuration_errors()
        
        # Verify
        assert errors == validation_errors
    
    def test_is_service_available(self, service_manager, sample_service_config):
        """Test checking service availability."""
        # Setup
        service_manager._services = {"user-service": sample_service_config}
        
        # Execute & Verify
        assert service_manager.is_service_available("user-service") is True
        assert service_manager.is_service_available("missing-service") is False
    
    def test_get_gateway_config(self, service_manager, sample_config_data):
        """Test getting gateway configuration."""
        # Setup
        service_manager._config_data = sample_config_data
        
        # Execute
        gateway_config = service_manager.get_gateway_config()
        
        # Verify
        assert gateway_config == sample_config_data.gateway
    
    @pytest.mark.asyncio
    async def test_reload_configuration(self, service_manager, mock_config_loader, sample_config_data):
        """Test configuration reload."""
        # Setup
        mock_health_checker = AsyncMock()
        service_manager._health_checker = mock_health_checker
        
        mock_http_client = AsyncMock()
        service_manager._http_clients = {"old-service": mock_http_client}
        
        mock_config_loader.load_config.return_value = sample_config_data
        
        # Execute
        result = await service_manager.reload_configuration("/new/path")
        
        # Verify
        assert result is True
        # stop_monitoring is called twice: once in reload_configuration and once in initialize
        assert mock_health_checker.stop_monitoring.call_count == 2
        mock_http_client.close.assert_called_once()
        mock_config_loader.load_config.assert_called_with("/new/path")
    
    @pytest.mark.asyncio
    async def test_shutdown(self, service_manager):
        """Test service manager shutdown."""
        # Setup
        mock_health_checker = AsyncMock()
        service_manager._health_checker = mock_health_checker
        
        mock_http_client = AsyncMock()
        service_manager._http_clients = {"test-service": mock_http_client}
        service_manager._services = {"test-service": Mock()}
        service_manager._status_callbacks = [Mock()]
        
        # Execute
        await service_manager.shutdown()
        
        # Verify
        mock_health_checker.stop_monitoring.assert_called_once()
        mock_http_client.close.assert_called_once()
        assert len(service_manager._services) == 0
        assert len(service_manager._http_clients) == 0
        assert len(service_manager._status_callbacks) == 0


class TestEndpointInfo:
    """Test cases for EndpointInfo class."""
    
    def test_endpoint_info_creation(self):
        """Test EndpointInfo object creation."""
        endpoint = EndpointInfo(
            path="/users",
            method="GET",
            description="Get all users",
            sample_payload={"test": "data"}
        )
        
        assert endpoint.path == "/users"
        assert endpoint.method == "GET"
        assert endpoint.description == "Get all users"
        assert endpoint.sample_payload == {"test": "data"}
    
    def test_endpoint_info_string_representation(self):
        """Test EndpointInfo string representation."""
        endpoint = EndpointInfo(
            path="/users/{id}",
            method="PUT",
            description="Update user"
        )
        
        assert str(endpoint) == "PUT /users/{id}"


class TestServiceExecutionResult:
    """Test cases for ServiceExecutionResult class."""
    
    def test_service_execution_result_properties(self):
        """Test ServiceExecutionResult properties."""
        request_result = RequestResult(
            success=True,
            status_code=200,
            response_data={"id": 1, "name": "John"},
            response_time=150.0,
            error_message=None
        )
        
        execution_result = ServiceExecutionResult(
            service_name="user-service",
            endpoint="/users/1",
            method="GET",
            success=True,
            request_result=request_result,
            execution_time=datetime.now()
        )
        
        assert execution_result.status_code == 200
        assert execution_result.response_data == {"id": 1, "name": "John"}
        assert execution_result.error_message is None
        assert execution_result.response_time == 150.0
    
    def test_service_execution_result_with_error(self):
        """Test ServiceExecutionResult with error."""
        request_result = RequestResult(
            success=False,
            status_code=404,
            response_data={},
            response_time=0,
            error_message="Not found"
        )
        
        execution_result = ServiceExecutionResult(
            service_name="user-service",
            endpoint="/users/999",
            method="GET",
            success=False,
            request_result=request_result,
            execution_time=datetime.now()
        )
        
        assert execution_result.status_code == 404
        assert execution_result.response_data == {}
        assert execution_result.error_message == "Not found"
        assert execution_result.response_time == 0