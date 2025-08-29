"""
Unit tests for sample endpoint system.
Tests sample endpoint provider, loader, and integration.
"""
import pytest
import os
from unittest.mock import Mock, patch

from config.sample_endpoints import (
    SampleEndpointProvider, SampleEndpoint, get_sample_endpoint_provider
)
from config.sample_endpoint_loader import (
    SampleEndpointLoader, get_sample_endpoint_loader
)
from services.service_manager import EndpointInfo


class TestSampleEndpoint:
    """Test cases for SampleEndpoint class."""
    
    def test_sample_endpoint_creation(self):
        """Test SampleEndpoint object creation."""
        endpoint = SampleEndpoint(
            path="/users",
            method="GET",
            description="Get all users",
            category="User Management",
            tags=["users", "list"],
            sample_payload={"test": "data"},
            expected_response={"users": []},
            requires_auth=True
        )
        
        assert endpoint.path == "/users"
        assert endpoint.method == "GET"
        assert endpoint.description == "Get all users"
        assert endpoint.category == "User Management"
        assert endpoint.tags == ["users", "list"]
        assert endpoint.sample_payload == {"test": "data"}
        assert endpoint.expected_response == {"users": []}
        assert endpoint.requires_auth is True
    
    def test_sample_endpoint_defaults(self):
        """Test SampleEndpoint with default values."""
        endpoint = SampleEndpoint(
            path="/health",
            method="GET",
            description="Health check"
        )
        
        assert endpoint.category == "General"
        assert endpoint.tags == []
        assert endpoint.sample_payload is None
        assert endpoint.expected_response is None
        assert endpoint.requires_auth is False
    
    def test_sample_endpoint_string_representation(self):
        """Test SampleEndpoint string representation."""
        endpoint = SampleEndpoint(
            path="/users/{id}",
            method="PUT",
            description="Update user"
        )
        
        assert str(endpoint) == "PUT /users/{id}"


class TestSampleEndpointProvider:
    """Test cases for SampleEndpointProvider class."""
    
    @pytest.fixture
    def provider(self):
        """Create sample endpoint provider."""
        return SampleEndpointProvider()
    
    def test_provider_initialization(self, provider):
        """Test provider initialization."""
        assert provider is not None
        
        # Should have predefined services
        services = provider.get_all_services()
        assert len(services) > 0
        assert "user-service" in services
        assert "transaction-service" in services
        assert "product-service" in services
    
    def test_get_endpoints_for_service(self, provider):
        """Test getting endpoints for specific service."""
        # Test user service
        user_endpoints = provider.get_endpoints_for_service("user-service")
        assert len(user_endpoints) > 0
        
        # Verify endpoint structure
        for endpoint in user_endpoints:
            assert isinstance(endpoint, SampleEndpoint)
            assert endpoint.path.startswith("/")
            assert endpoint.method in ["GET", "POST", "PUT", "PATCH", "DELETE"]
            assert len(endpoint.description) > 0
        
        # Test non-existent service
        empty_endpoints = provider.get_endpoints_for_service("nonexistent-service")
        assert len(empty_endpoints) == 0
    
    def test_get_categories_for_service(self, provider):
        """Test getting categories for specific service."""
        categories = provider.get_categories_for_service("user-service")
        assert len(categories) > 0
        assert "User Management" in categories
        
        # Test non-existent service
        empty_categories = provider.get_categories_for_service("nonexistent-service")
        assert len(empty_categories) == 0
    
    def test_get_endpoints_by_category(self, provider):
        """Test getting endpoints by category."""
        user_mgmt_endpoints = provider.get_endpoints_by_category("user-service", "User Management")
        assert len(user_mgmt_endpoints) > 0
        
        for endpoint in user_mgmt_endpoints:
            assert endpoint.category == "User Management"
        
        # Test non-existent category
        empty_endpoints = provider.get_endpoints_by_category("user-service", "Nonexistent Category")
        assert len(empty_endpoints) == 0
    
    def test_search_endpoints(self, provider):
        """Test endpoint search functionality."""
        # Search for user-related endpoints
        user_results = provider.search_endpoints("user-service", "user")
        assert len(user_results) > 0
        
        for endpoint in user_results:
            search_text = f"{endpoint.path} {endpoint.description} {' '.join(endpoint.tags)}".lower()
            assert "user" in search_text
        
        # Search for health endpoints
        health_results = provider.search_endpoints("user-service", "health")
        assert len(health_results) > 0
        
        # Search with no results
        no_results = provider.search_endpoints("user-service", "nonexistent_term_xyz")
        assert len(no_results) == 0
    
    def test_get_endpoint_by_path_and_method(self, provider):
        """Test getting specific endpoint by path and method."""
        endpoint = provider.get_endpoint_by_path_and_method("user-service", "/users", "GET")
        assert endpoint is not None
        assert endpoint.path == "/users"
        assert endpoint.method == "GET"
        
        # Test non-existent endpoint
        no_endpoint = provider.get_endpoint_by_path_and_method("user-service", "/nonexistent", "GET")
        assert no_endpoint is None
    
    def test_service_specific_endpoints(self, provider):
        """Test that different services have appropriate endpoints."""
        # User service should have user-related endpoints
        user_endpoints = provider.get_endpoints_for_service("user-service")
        user_paths = [ep.path for ep in user_endpoints]
        assert any("/users" in path for path in user_paths)
        
        # Transaction service should have transaction-related endpoints
        txn_endpoints = provider.get_endpoints_for_service("transaction-service")
        txn_paths = [ep.path for ep in txn_endpoints]
        assert any("/transactions" in path for path in txn_paths)
        
        # Product service should have product-related endpoints
        product_endpoints = provider.get_endpoints_for_service("product-service")
        product_paths = [ep.path for ep in product_endpoints]
        assert any("/products" in path for path in product_paths)
    
    def test_endpoint_payloads(self, provider):
        """Test that POST/PUT endpoints have sample payloads."""
        user_endpoints = provider.get_endpoints_for_service("user-service")
        
        post_endpoints = [ep for ep in user_endpoints if ep.method == "POST"]
        for endpoint in post_endpoints:
            assert endpoint.sample_payload is not None, f"POST endpoint {endpoint.path} should have sample payload"
        
        put_endpoints = [ep for ep in user_endpoints if ep.method == "PUT"]
        for endpoint in put_endpoints:
            assert endpoint.sample_payload is not None, f"PUT endpoint {endpoint.path} should have sample payload"


class TestSampleEndpointLoader:
    """Test cases for SampleEndpointLoader class."""
    
    @pytest.fixture
    def loader(self):
        """Create sample endpoint loader."""
        return SampleEndpointLoader()
    
    def test_loader_initialization(self, loader):
        """Test loader initialization."""
        assert loader is not None
        assert loader.provider is not None
    
    def test_load_from_environment_basic(self, loader):
        """Test loading endpoints from environment variables."""
        env_vars = {
            'MCP_SERVICES': 'test-service',
            'MCP_SERVICE_TEST_SERVICE_SAMPLE_ENDPOINTS': 'GET /test,POST /test',
            'MCP_SERVICE_TEST_SERVICE_ENDPOINT_0_DESCRIPTION': 'Get test data',
            'MCP_SERVICE_TEST_SERVICE_ENDPOINT_0_CATEGORY': 'Testing',
            'MCP_SERVICE_TEST_SERVICE_ENDPOINT_1_DESCRIPTION': 'Create test data',
            'MCP_SERVICE_TEST_SERVICE_ENDPOINT_1_CATEGORY': 'Testing',
            'MCP_SERVICE_TEST_SERVICE_ENDPOINT_1_PAYLOAD': '{"name": "test"}'
        }
        
        result = loader.load_from_environment(env_vars)
        
        assert "test-service" in result
        endpoints = result["test-service"]
        assert len(endpoints) == 2
        
        get_endpoint = next((ep for ep in endpoints if ep.method == "GET"), None)
        assert get_endpoint is not None
        assert get_endpoint.path == "/test"
        assert get_endpoint.description == "Get test data"
        assert get_endpoint.category == "Testing"
        
        post_endpoint = next((ep for ep in endpoints if ep.method == "POST"), None)
        assert post_endpoint is not None
        assert post_endpoint.path == "/test"
        assert post_endpoint.description == "Create test data"
        assert post_endpoint.sample_payload == {"name": "test"}
    
    def test_load_from_environment_with_defaults(self, loader):
        """Test loading with default endpoints merged."""
        env_vars = {
            'MCP_SERVICES': 'user-service',
            'MCP_SERVICE_USER_SERVICE_SAMPLE_ENDPOINTS': 'GET /custom-endpoint',
            'MCP_SERVICE_USER_SERVICE_ENDPOINT_0_DESCRIPTION': 'Custom endpoint'
        }
        
        result = loader.load_from_environment(env_vars)
        
        assert "user-service" in result
        endpoints = result["user-service"]
        
        # Should have both custom and default endpoints
        paths = [ep.path for ep in endpoints]
        assert "/custom-endpoint" in paths
        
        # Should also have default user service endpoints
        default_paths = [ep.path for ep in loader.provider.get_endpoints_for_service("user-service")]
        for default_path in default_paths:
            assert default_path in paths
    
    def test_get_configured_endpoints(self, loader):
        """Test getting configured endpoints for a service."""
        # Initially no configured endpoints
        configured = loader.get_configured_endpoints("test-service")
        assert len(configured) == 0
        
        # Load some configuration
        env_vars = {
            'MCP_SERVICES': 'test-service',
            'MCP_SERVICE_TEST_SERVICE_SAMPLE_ENDPOINTS': 'GET /configured'
        }
        loader.load_from_environment(env_vars)
        
        # Now should have configured endpoints
        configured = loader.get_configured_endpoints("test-service")
        assert len(configured) == 1
        assert configured[0].path == "/configured"
    
    def test_merge_with_defaults(self, loader):
        """Test merging configured endpoints with defaults."""
        # Configure custom endpoints
        custom_endpoints = [
            SampleEndpoint("/custom1", "GET", "Custom endpoint 1"),
            SampleEndpoint("/custom2", "POST", "Custom endpoint 2")
        ]
        
        merged = loader.merge_with_defaults("user-service", custom_endpoints)
        
        # Should have both custom and default endpoints
        custom_paths = [ep.path for ep in custom_endpoints]
        default_paths = [ep.path for ep in loader.provider.get_endpoints_for_service("user-service")]
        merged_paths = [ep.path for ep in merged]
        
        for path in custom_paths:
            assert path in merged_paths
        
        for path in default_paths:
            assert path in merged_paths
        
        # Custom endpoints should override defaults with same path/method
        custom_get_users = SampleEndpoint("/users", "GET", "Custom get users")
        merged_with_override = loader.merge_with_defaults("user-service", [custom_get_users])
        
        get_users_endpoints = [ep for ep in merged_with_override if ep.path == "/users" and ep.method == "GET"]
        assert len(get_users_endpoints) == 1
        assert get_users_endpoints[0].description == "Custom get users"
    
    def test_parse_endpoint_string(self, loader):
        """Test parsing endpoint strings."""
        # Valid endpoint strings
        valid_cases = [
            ("GET /users", ("GET", "/users")),
            ("POST /users", ("POST", "/users")),
            ("PUT /users/{id}", ("PUT", "/users/{id}")),
            ("DELETE /users/{id}", ("DELETE", "/users/{id}"))
        ]
        
        for endpoint_str, expected in valid_cases:
            result = loader._parse_endpoint_string(endpoint_str)
            assert result == expected
        
        # Invalid endpoint strings
        invalid_cases = [
            "",
            "GET",
            "/users",
            "INVALID /users",
            "GET users"  # Missing leading slash
        ]
        
        for endpoint_str in invalid_cases:
            result = loader._parse_endpoint_string(endpoint_str)
            assert result is None
    
    def test_parse_json_payload(self, loader):
        """Test parsing JSON payloads."""
        # Valid JSON
        valid_json = '{"name": "test", "value": 123}'
        result = loader._parse_json_payload(valid_json)
        assert result == {"name": "test", "value": 123}
        
        # Invalid JSON
        invalid_json = '{"invalid": json}'
        result = loader._parse_json_payload(invalid_json)
        assert result is None
        
        # Empty string
        result = loader._parse_json_payload("")
        assert result is None
        
        # None input
        result = loader._parse_json_payload(None)
        assert result is None


class TestSampleEndpointIntegration:
    """Integration tests for sample endpoint system."""
    
    def test_get_sample_endpoint_provider_singleton(self):
        """Test that get_sample_endpoint_provider returns singleton."""
        provider1 = get_sample_endpoint_provider()
        provider2 = get_sample_endpoint_provider()
        
        assert provider1 is provider2
    
    def test_get_sample_endpoint_loader_singleton(self):
        """Test that get_sample_endpoint_loader returns singleton."""
        loader1 = get_sample_endpoint_loader()
        loader2 = get_sample_endpoint_loader()
        
        assert loader1 is loader2
    
    def test_endpoint_info_conversion(self):
        """Test conversion between SampleEndpoint and EndpointInfo."""
        sample_endpoint = SampleEndpoint(
            path="/users",
            method="GET",
            description="Get all users",
            sample_payload={"test": "data"}
        )
        
        # Convert to EndpointInfo
        endpoint_info = EndpointInfo(
            path=sample_endpoint.path,
            method=sample_endpoint.method,
            description=sample_endpoint.description,
            sample_payload=sample_endpoint.sample_payload
        )
        
        assert endpoint_info.path == sample_endpoint.path
        assert endpoint_info.method == sample_endpoint.method
        assert endpoint_info.description == sample_endpoint.description
        assert endpoint_info.sample_payload == sample_endpoint.sample_payload
    
    def test_comprehensive_service_coverage(self):
        """Test that all expected services have comprehensive endpoint coverage."""
        provider = get_sample_endpoint_provider()
        
        expected_services = ["user-service", "transaction-service", "product-service"]
        
        for service_name in expected_services:
            endpoints = provider.get_endpoints_for_service(service_name)
            
            # Should have multiple endpoints
            assert len(endpoints) >= 5, f"{service_name} should have at least 5 endpoints"
            
            # Should have different HTTP methods
            methods = set(ep.method for ep in endpoints)
            assert "GET" in methods, f"{service_name} should have GET endpoints"
            assert "POST" in methods, f"{service_name} should have POST endpoints"
            
            # Should have health endpoint
            health_endpoints = [ep for ep in endpoints if "health" in ep.path.lower()]
            assert len(health_endpoints) > 0, f"{service_name} should have health endpoint"
            
            # Should have multiple categories
            categories = provider.get_categories_for_service(service_name)
            assert len(categories) >= 2, f"{service_name} should have multiple categories"
    
    def test_search_across_all_services(self):
        """Test search functionality across all services."""
        provider = get_sample_endpoint_provider()
        services = provider.get_all_services()
        
        # Search for common terms across all services
        common_terms = ["health", "status", "list", "create"]
        
        for term in common_terms:
            total_results = 0
            for service in services:
                results = provider.search_endpoints(service, term)
                total_results += len(results)
            
            assert total_results > 0, f"Search term '{term}' should return results across services"


if __name__ == '__main__':
    pytest.main([__file__])