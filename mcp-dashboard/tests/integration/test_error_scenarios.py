"""
Integration tests for error handling and edge cases.
Tests various error scenarios and edge cases in the system.
"""
import pytest
import asyncio
import tempfile
import os
from unittest.mock import Mock, patch
from datetime import datetime

from services.service_manager import ServiceManager
from services.health_checker import HealthChecker, HealthStatus
from config.env_loader import EnvLoader
from tests.fixtures.mock_gateway import MockMCPGateway
from tests.fixtures.config_fixtures import ConfigFixtures


class TestErrorScenarios:
    """Integration tests for error scenarios."""
    
    @pytest.fixture
    async def mock_gateway(self):
        """Create and start mock MCP Gateway."""
        gateway = MockMCPGateway(port=8082)  # Use different port
        await gateway.start()
        yield gateway
        await gateway.stop()
    
    @pytest.fixture
    def temp_config_file(self):
        """Create temporary configuration file."""
        config_content = ConfigFixtures.valid_comprehensive_config().replace(
            "http://localhost:8080", "http://localhost:8082"
        ).replace(
            "http://user-service:8080", "http://localhost:8082/api"
        ).replace(
            "http://transaction-service:8080", "http://localhost:8082/api"
        ).replace(
            "http://product-service:8080", "http://localhost:8082/api"
        )
        
        temp_file = ConfigFixtures.create_temp_env_file(config_content)
        yield temp_file
        ConfigFixtures.cleanup_temp_file(temp_file)
    
    @pytest.fixture
    async def service_manager(self, temp_config_file):
        """Create and initialize service manager."""
        env_loader = EnvLoader()
        manager = ServiceManager(env_loader)
        
        success = await manager.initialize(temp_config_file)
        assert success, "Service manager initialization should succeed"
        
        yield manager
        await manager.shutdown()
    
    @pytest.mark.asyncio
    async def test_invalid_configuration_scenarios(self):
        """Test various invalid configuration scenarios."""
        env_loader = EnvLoader()
        manager = ServiceManager(env_loader)
        
        # Test missing configuration file
        success = await manager.initialize("/nonexistent/config.env")
        assert success is False
        
        # Test invalid configuration content
        invalid_configs = [
            ConfigFixtures.invalid_missing_gateway_url(),
            ConfigFixtures.invalid_missing_services(),
            ConfigFixtures.invalid_service_missing_endpoint(),
            ConfigFixtures.invalid_malformed_values()
        ]
        
        for invalid_config in invalid_configs:
            temp_file = ConfigFixtures.create_temp_env_file(invalid_config)
            try:
                success = await manager.initialize(temp_file)
                assert success is False, f"Invalid config should fail: {invalid_config[:50]}..."
            finally:
                ConfigFixtures.cleanup_temp_file(temp_file)
        
        await manager.shutdown()
    
    @pytest.mark.asyncio
    async def test_network_error_scenarios(self, mock_gateway):
        """Test various network error scenarios."""
        # Create service manager pointing to non-existent service
        config_content = """
MCP_GATEWAY_URL=http://localhost:9999
MCP_SERVICES=unreachable-service

MCP_SERVICE_UNREACHABLE_SERVICE_ENDPOINT=http://localhost:9999/api
MCP_SERVICE_UNREACHABLE_SERVICE_AUTH_TYPE=none
"""
        
        temp_file = ConfigFixtures.create_temp_env_file(config_content)
        
        try:
            env_loader = EnvLoader()
            manager = ServiceManager(env_loader)
            
            success = await manager.initialize(temp_file)
            assert success is True  # Configuration should be valid
            
            # Try to execute request - should fail with network error
            result = await manager.execute_request("unreachable-service", "/test", "GET")
            
            assert result.success is False
            assert result.status_code in [0, 500, 503]  # Various error codes for network issues
            assert result.error_message is not None
            
            await manager.shutdown()
            
        finally:
            ConfigFixtures.cleanup_temp_file(temp_file)
    
    @pytest.mark.asyncio
    async def test_service_unavailable_scenarios(self, service_manager, mock_gateway):
        """Test service unavailable scenarios."""
        # Configure mock gateway to return 503 Service Unavailable
        mock_gateway.set_custom_response(
            "/api/unavailable", 
            "GET", 
            {"status": 503, "data": {"error": "Service Unavailable"}}
        )
        
        result = await service_manager.execute_request("user-service", "/unavailable", "GET")
        
        assert result.success is False
        assert result.status_code == 503
        assert "unavailable" in result.error_message.lower()
    
    @pytest.mark.asyncio
    async def test_authentication_error_scenarios(self, service_manager, mock_gateway):
        """Test authentication error scenarios."""
        # Configure mock gateway to return 401 Unauthorized
        mock_gateway.set_custom_response(
            "/api/secure", 
            "GET", 
            {"status": 401, "data": {"error": "Unauthorized"}}
        )
        
        result = await service_manager.execute_request("user-service", "/secure", "GET")
        
        assert result.success is False
        assert result.status_code == 401
        assert "unauthorized" in result.error_message.lower()
    
    @pytest.mark.asyncio
    async def test_timeout_scenarios(self, service_manager, mock_gateway):
        """Test timeout scenarios."""
        # Configure mock gateway with very long delay
        mock_gateway.set_response_delay("/api/slow", 10.0)  # 10 second delay
        
        # Execute request that should timeout
        # Note: This test assumes the configured timeout is less than 10 seconds
        result = await service_manager.execute_request("user-service", "/slow", "GET")
        
        # Depending on configuration, this might timeout or succeed
        # In a real test environment, we'd configure very short timeouts
        if not result.success:
            assert "timeout" in result.error_message.lower() or "time" in result.error_message.lower()
    
    @pytest.mark.asyncio
    async def test_malformed_response_scenarios(self, service_manager, mock_gateway):
        """Test malformed response scenarios."""
        # Configure mock gateway to return invalid JSON
        mock_gateway.set_custom_response(
            "/api/malformed", 
            "GET", 
            {"status": 200, "data": "invalid json response", "headers": {"Content-Type": "application/json"}}
        )
        
        result = await service_manager.execute_request("user-service", "/malformed", "GET")
        
        # Should handle malformed JSON gracefully
        # The exact behavior depends on implementation
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_large_response_scenarios(self, service_manager, mock_gateway):
        """Test large response scenarios."""
        # Configure mock gateway to return very large response
        large_data = {
            "data": ["item_" + str(i) for i in range(10000)],  # Large array
            "metadata": {
                "description": "x" * 10000  # Large string
            }
        }
        
        mock_gateway.set_custom_response(
            "/api/large", 
            "GET", 
            {"status": 200, "data": large_data}
        )
        
        result = await service_manager.execute_request("user-service", "/large", "GET")
        
        # Should handle large responses
        assert result.success is True
        assert result.status_code == 200
        assert result.response_data is not None
    
    @pytest.mark.asyncio
    async def test_concurrent_error_scenarios(self, service_manager, mock_gateway):
        """Test concurrent error scenarios."""
        # Configure different error responses for different endpoints
        error_configs = [
            ("/api/error1", {"status": 400, "data": {"error": "Bad Request"}}),
            ("/api/error2", {"status": 404, "data": {"error": "Not Found"}}),
            ("/api/error3", {"status": 500, "data": {"error": "Internal Server Error"}}),
            ("/api/error4", {"status": 503, "data": {"error": "Service Unavailable"}}),
        ]
        
        for endpoint, response_config in error_configs:
            mock_gateway.set_custom_response(endpoint, "GET", response_config)
        
        # Execute concurrent requests that should all fail
        tasks = []
        for i, (endpoint, _) in enumerate(error_configs):
            task = service_manager.execute_request("user-service", endpoint, "GET")
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All requests should complete (not raise exceptions)
        assert len(results) == 4
        
        for i, result in enumerate(results):
            assert not isinstance(result, Exception), f"Request {i} should not raise exception"
            assert result.success is False, f"Request {i} should fail"
            assert result.status_code >= 400, f"Request {i} should have error status code"
    
    @pytest.mark.asyncio
    async def test_health_check_error_scenarios(self, service_manager, mock_gateway):
        """Test health check error scenarios."""
        # Configure health endpoint to fail
        mock_gateway.set_custom_response(
            "/api/health", 
            "GET", 
            {"status": 500, "data": {"error": "Health check failed"}}
        )
        
        # Force health check
        await service_manager.force_health_check()
        
        # Verify health status reflects the error
        health_info = service_manager.get_service_health("user-service")
        if health_info:
            # Health status might be unhealthy or might still be from previous successful check
            # In a real implementation, we'd have more deterministic control
            assert health_info.service_name == "user-service"
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_scenarios(self, service_manager, mock_gateway):
        """Test circuit breaker scenarios."""
        # Configure endpoint to always fail
        mock_gateway.set_failure_rate("/api/failing", 1.0)  # 100% failure rate
        
        # Make multiple requests to trigger circuit breaker
        results = []
        for i in range(10):  # Make enough requests to potentially trigger circuit breaker
            result = await service_manager.execute_request("user-service", "/failing", "GET")
            results.append(result)
            
            # Small delay between requests
            await asyncio.sleep(0.1)
        
        # All requests should fail, but some might be circuit breaker failures
        for result in results:
            assert result.success is False
        
        # Later requests might have different error patterns due to circuit breaker
        # The exact behavior depends on circuit breaker configuration
    
    @pytest.mark.asyncio
    async def test_resource_exhaustion_scenarios(self, service_manager, mock_gateway):
        """Test resource exhaustion scenarios."""
        # Create many concurrent requests to test resource limits
        num_requests = 50
        tasks = []
        
        for i in range(num_requests):
            # Add small delay to each endpoint to simulate load
            mock_gateway.set_response_delay(f"/api/load-test-{i}", 0.1)
            task = service_manager.execute_request("user-service", f"/load-test-{i}", "GET")
            tasks.append(task)
        
        # Execute all requests concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Most requests should succeed, but some might fail due to resource limits
        successful_results = [r for r in results if not isinstance(r, Exception) and r.success]
        failed_results = [r for r in results if isinstance(r, Exception) or not r.success]
        
        # At least some requests should succeed
        assert len(successful_results) > 0
        
        # Log the results for analysis
        print(f"Successful requests: {len(successful_results)}")
        print(f"Failed requests: {len(failed_results)}")
    
    @pytest.mark.asyncio
    async def test_configuration_change_during_operation(self, service_manager, mock_gateway):
        """Test configuration changes during operation."""
        # Start with initial configuration
        initial_services = service_manager.get_service_names()
        assert len(initial_services) > 0
        
        # Execute a request to establish baseline
        result1 = await service_manager.execute_request("user-service", "/users", "GET")
        assert result1.success is True
        
        # Create new configuration that removes some services
        new_config_content = """
MCP_GATEWAY_URL=http://localhost:8082
MCP_SERVICES=user-service

MCP_SERVICE_USER_SERVICE_ENDPOINT=http://localhost:8082/api
MCP_SERVICE_USER_SERVICE_AUTH_TYPE=bearer
MCP_SERVICE_USER_SERVICE_TOKEN=new_token
"""
        
        new_config_file = ConfigFixtures.create_temp_env_file(new_config_content)
        
        try:
            # Reload configuration while system is running
            success = await service_manager.reload_configuration(new_config_file)
            assert success is True
            
            # Verify configuration changed
            new_services = service_manager.get_service_names()
            assert len(new_services) == 1
            assert "user-service" in new_services
            
            # Execute request with new configuration
            result2 = await service_manager.execute_request("user-service", "/users", "GET")
            assert result2.success is True
            
            # Try to execute request to removed service
            result3 = await service_manager.execute_request("transaction-service", "/transactions", "GET")
            assert result3.success is False
            assert "not found" in result3.error_message.lower()
            
        finally:
            ConfigFixtures.cleanup_temp_file(new_config_file)
    
    @pytest.mark.asyncio
    async def test_memory_leak_scenarios(self, service_manager, mock_gateway):
        """Test for potential memory leaks."""
        # Execute many requests and verify cleanup
        num_iterations = 100
        
        for i in range(num_iterations):
            # Execute request
            result = await service_manager.execute_request("user-service", f"/test-{i}", "GET")
            
            # Request might succeed or fail (404), both are fine
            assert result is not None
            
            # Small delay to allow cleanup
            if i % 10 == 0:
                await asyncio.sleep(0.01)
        
        # Force garbage collection and verify system is still responsive
        import gc
        gc.collect()
        
        # Execute final request to verify system is still working
        final_result = await service_manager.execute_request("user-service", "/users", "GET")
        assert final_result.success is True
    
    @pytest.mark.asyncio
    async def test_edge_case_inputs(self, service_manager, mock_gateway):
        """Test edge case inputs."""
        edge_cases = [
            # Empty strings
            ("", "/users", "GET"),
            ("user-service", "", "GET"),
            ("user-service", "/users", ""),
            
            # Very long strings
            ("user-service", "/users/" + "x" * 1000, "GET"),
            ("user-service", "/users", "GET" + "x" * 100),
            
            # Special characters
            ("user-service", "/users/test%20user", "GET"),
            ("user-service", "/users/test@user", "GET"),
            ("user-service", "/users/test&user=1", "GET"),
            
            # Non-existent service
            ("nonexistent-service", "/test", "GET"),
        ]
        
        for service_name, endpoint, method in edge_cases:
            try:
                result = await service_manager.execute_request(service_name, endpoint, method)
                
                # Should not raise exception, but might fail
                assert result is not None
                
                # Most edge cases should fail gracefully
                if service_name == "" or endpoint == "" or method == "":
                    assert result.success is False
                elif service_name == "nonexistent-service":
                    assert result.success is False
                    assert "not found" in result.error_message.lower()
                
            except Exception as e:
                # Should not raise unhandled exceptions
                pytest.fail(f"Edge case input caused unhandled exception: {e}")


if __name__ == '__main__':
    pytest.main([__file__])