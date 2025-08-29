"""
Unit tests for configuration management system.
"""
import unittest
import tempfile
import os
from pathlib import Path

from config import (
    EnvLoader, ServiceConfig, GatewayConfig, RetryConfig,
    CircuitBreakerConfig, RateLimitConfig, ConfigurationData,
    ValidationError, AuthType, RetryStrategy
)


class TestEnvLoader(unittest.TestCase):
    """Test cases for EnvLoader class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.loader = EnvLoader()
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test fixtures."""
        # Clean up temporary files
        for file in Path(self.temp_dir).glob("*"):
            file.unlink()
        os.rmdir(self.temp_dir)
    
    def _create_temp_env_file(self, content: str) -> str:
        """Create a temporary .env file with given content."""
        env_file = Path(self.temp_dir) / ".env.test"
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(content)
        return str(env_file)
    
    def test_load_valid_config(self):
        """Test loading a valid configuration file."""
        env_content = """
# MCP Gateway Configuration
MCP_GATEWAY_URL=http://localhost:8080
MCP_DEFAULT_TIMEOUT=30000
PORT=8080

# Retry Policy
MCP_RETRY_MAX_ATTEMPTS=3
MCP_RETRY_STRATEGY=exponential
MCP_RETRY_INITIAL_DELAY=1000
MCP_RETRY_MAX_DELAY=30000
MCP_RETRY_JITTER=true

# Services
MCP_SERVICES=user-service,transaction-service

# User Service Configuration
MCP_SERVICE_USER_SERVICE_ENDPOINT=http://user-service:8080
MCP_SERVICE_USER_SERVICE_AUTH_TYPE=bearer
MCP_SERVICE_USER_SERVICE_TOKEN=test_token
MCP_SERVICE_USER_SERVICE_TIMEOUT=30000
MCP_SERVICE_USER_SERVICE_RATE_LIMIT_RPM=100
MCP_SERVICE_USER_SERVICE_RATE_LIMIT_BURST=20
MCP_SERVICE_USER_SERVICE_CB_FAILURE_THRESHOLD=5
MCP_SERVICE_USER_SERVICE_CB_RECOVERY_TIMEOUT=30000
MCP_SERVICE_USER_SERVICE_CB_HALF_OPEN_MAX_CALLS=3

# Transaction Service Configuration
MCP_SERVICE_TRANSACTION_SERVICE_ENDPOINT=http://transaction-service:8080
MCP_SERVICE_TRANSACTION_SERVICE_AUTH_TYPE=api-key
MCP_SERVICE_TRANSACTION_SERVICE_API_KEY=test_api_key
MCP_SERVICE_TRANSACTION_SERVICE_TIMEOUT=15000
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        # Verify configuration is valid
        self.assertTrue(config.is_valid, f"Config should be valid. Errors: {config.validation_errors}")
        
        # Verify gateway configuration
        self.assertEqual(config.gateway.url, "http://localhost:8080")
        self.assertEqual(config.gateway.port, 8080)
        self.assertEqual(config.gateway.default_timeout, 30000)
        
        # Verify retry configuration
        self.assertEqual(config.gateway.retry_config.max_attempts, 3)
        self.assertEqual(config.gateway.retry_config.strategy, RetryStrategy.EXPONENTIAL)
        self.assertEqual(config.gateway.retry_config.initial_delay, 1000)
        self.assertEqual(config.gateway.retry_config.max_delay, 30000)
        self.assertTrue(config.gateway.retry_config.jitter)
        
        # Verify services
        self.assertEqual(len(config.services), 2)
        
        # Verify user service
        user_service = config.get_service("user-service")
        self.assertIsNotNone(user_service)
        self.assertEqual(user_service.name, "user-service")
        self.assertEqual(user_service.endpoint, "http://user-service:8080")
        self.assertEqual(user_service.auth_type, AuthType.BEARER)
        self.assertEqual(user_service.token, "test_token")
        self.assertEqual(user_service.timeout, 30000)
        self.assertEqual(user_service.rate_limit.requests_per_minute, 100)
        self.assertEqual(user_service.rate_limit.burst_limit, 20)
        self.assertEqual(user_service.circuit_breaker.failure_threshold, 5)
        self.assertEqual(user_service.circuit_breaker.recovery_timeout, 30000)
        self.assertEqual(user_service.circuit_breaker.half_open_max_calls, 3)
        
        # Verify transaction service
        txn_service = config.get_service("transaction-service")
        self.assertIsNotNone(txn_service)
        self.assertEqual(txn_service.name, "transaction-service")
        self.assertEqual(txn_service.endpoint, "http://transaction-service:8080")
        self.assertEqual(txn_service.auth_type, AuthType.API_KEY)
        self.assertEqual(txn_service.api_key, "test_api_key")
        self.assertEqual(txn_service.timeout, 15000)
    
    def test_load_missing_file(self):
        """Test loading a non-existent configuration file."""
        config = self.loader.load_config("/non/existent/file.env")
        
        self.assertFalse(config.is_valid)
        self.assertEqual(len(config.validation_errors), 1)
        self.assertIn("Environment file not found", str(config.validation_errors[0]))
    
    def test_load_invalid_url(self):
        """Test loading configuration with invalid URL."""
        env_content = """
MCP_GATEWAY_URL=invalid-url
MCP_SERVICES=test-service
MCP_SERVICE_TEST_SERVICE_ENDPOINT=also-invalid
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertFalse(config.is_valid)
        
        # Should have validation errors for invalid URLs
        url_errors = [e for e in config.validation_errors if "URL" in e.message]
        self.assertGreater(len(url_errors), 0)
    
    def test_load_invalid_port(self):
        """Test loading configuration with invalid port."""
        env_content = """
PORT=invalid_port
MCP_SERVICES=test-service
MCP_SERVICE_TEST_SERVICE_ENDPOINT=http://test:8080
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertFalse(config.is_valid)
        
        # Should have validation error for invalid port
        port_errors = [e for e in config.validation_errors if e.field == "PORT"]
        self.assertEqual(len(port_errors), 1)
        self.assertIn("valid integer", port_errors[0].message)
    
    def test_load_out_of_range_port(self):
        """Test loading configuration with out-of-range port."""
        env_content = """
PORT=99999
MCP_SERVICES=test-service
MCP_SERVICE_TEST_SERVICE_ENDPOINT=http://test:8080
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertFalse(config.is_valid)
        
        # Should have validation error for out-of-range port
        port_errors = [e for e in config.validation_errors if e.field == "PORT"]
        self.assertEqual(len(port_errors), 1)
        self.assertIn("between 1 and 65535", port_errors[0].message)
    
    def test_load_missing_services(self):
        """Test loading configuration with no services defined."""
        env_content = """
MCP_GATEWAY_URL=http://localhost:8080
# No MCP_SERVICES defined
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertFalse(config.is_valid)
        
        # Should have validation error for missing services
        service_errors = [e for e in config.validation_errors if e.field == "MCP_SERVICES"]
        self.assertEqual(len(service_errors), 1)
        self.assertIn("No services configured", service_errors[0].message)
    
    def test_load_service_missing_endpoint(self):
        """Test loading configuration with service missing endpoint."""
        env_content = """
MCP_SERVICES=test-service
# Missing MCP_SERVICE_TEST_SERVICE_ENDPOINT
MCP_SERVICE_TEST_SERVICE_AUTH_TYPE=bearer
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertFalse(config.is_valid)
        
        # Should have validation error for missing endpoint
        endpoint_errors = [e for e in config.validation_errors 
                          if "ENDPOINT" in e.field and "Missing required" in e.message]
        self.assertEqual(len(endpoint_errors), 1)
    
    def test_load_invalid_auth_type(self):
        """Test loading configuration with invalid auth type."""
        env_content = """
MCP_SERVICES=test-service
MCP_SERVICE_TEST_SERVICE_ENDPOINT=http://test:8080
MCP_SERVICE_TEST_SERVICE_AUTH_TYPE=invalid_auth
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertFalse(config.is_valid)
        
        # Should have validation error for invalid auth type
        auth_errors = [e for e in config.validation_errors 
                      if "AUTH_TYPE" in e.field and "Invalid auth type" in e.message]
        self.assertEqual(len(auth_errors), 1)
    
    def test_load_missing_auth_credentials(self):
        """Test loading configuration with missing auth credentials."""
        env_content = """
MCP_SERVICES=test-service
MCP_SERVICE_TEST_SERVICE_ENDPOINT=http://test:8080
MCP_SERVICE_TEST_SERVICE_AUTH_TYPE=bearer
# Missing MCP_SERVICE_TEST_SERVICE_TOKEN
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertFalse(config.is_valid)
        
        # Should have validation error for missing token
        token_errors = [e for e in config.validation_errors 
                       if "TOKEN" in e.field and "Missing token" in e.message]
        self.assertEqual(len(token_errors), 1)
    
    def test_load_invalid_retry_strategy(self):
        """Test loading configuration with invalid retry strategy."""
        env_content = """
MCP_RETRY_STRATEGY=invalid_strategy
MCP_SERVICES=test-service
MCP_SERVICE_TEST_SERVICE_ENDPOINT=http://test:8080
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertFalse(config.is_valid)
        
        # Should have validation error for invalid retry strategy
        strategy_errors = [e for e in config.validation_errors 
                          if "STRATEGY" in e.field and "Invalid retry strategy" in e.message]
        self.assertEqual(len(strategy_errors), 1)
    
    def test_load_negative_timeout(self):
        """Test loading configuration with negative timeout."""
        env_content = """
MCP_DEFAULT_TIMEOUT=-1000
MCP_SERVICES=test-service
MCP_SERVICE_TEST_SERVICE_ENDPOINT=http://test:8080
MCP_SERVICE_TEST_SERVICE_TIMEOUT=-500
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertFalse(config.is_valid)
        
        # Should have validation errors for negative timeouts
        timeout_errors = [e for e in config.validation_errors 
                         if "TIMEOUT" in e.field and "must be positive" in e.message]
        self.assertEqual(len(timeout_errors), 2)  # Gateway and service timeout
    
    def test_load_comments_and_empty_lines(self):
        """Test that comments and empty lines are properly ignored."""
        env_content = """
# This is a comment
MCP_GATEWAY_URL=http://localhost:8080

# Another comment
MCP_SERVICES=test-service

# Service configuration
MCP_SERVICE_TEST_SERVICE_ENDPOINT=http://test:8080
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        # Should load successfully despite comments and empty lines
        self.assertTrue(config.is_valid, f"Config should be valid. Errors: {config.validation_errors}")
        self.assertEqual(config.gateway.url, "http://localhost:8080")
        self.assertEqual(len(config.services), 1)
    
    def test_load_quoted_values(self):
        """Test loading configuration with quoted values."""
        env_content = """
MCP_GATEWAY_URL="http://localhost:8080"
MCP_SERVICES='test-service'
MCP_SERVICE_TEST_SERVICE_ENDPOINT="http://test:8080"
MCP_SERVICE_TEST_SERVICE_AUTH_TYPE='bearer'
MCP_SERVICE_TEST_SERVICE_TOKEN='quoted_token'
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertTrue(config.is_valid, f"Config should be valid. Errors: {config.validation_errors}")
        self.assertEqual(config.gateway.url, "http://localhost:8080")
        
        test_service = config.get_service("test-service")
        self.assertIsNotNone(test_service)
        self.assertEqual(test_service.endpoint, "http://test:8080")
        self.assertEqual(test_service.auth_type, AuthType.BEARER)
        self.assertEqual(test_service.token, "quoted_token")
    
    def test_sample_endpoints_generation(self):
        """Test that sample endpoints are generated correctly for different service types."""
        env_content = """
MCP_SERVICES=user-service,transaction-service,product-service,custom-service
MCP_SERVICE_USER_SERVICE_ENDPOINT=http://user:8080
MCP_SERVICE_TRANSACTION_SERVICE_ENDPOINT=http://transaction:8080
MCP_SERVICE_PRODUCT_SERVICE_ENDPOINT=http://product:8080
MCP_SERVICE_CUSTOM_SERVICE_ENDPOINT=http://custom:8080
"""
        
        env_file = self._create_temp_env_file(env_content)
        config = self.loader.load_config(env_file)
        
        self.assertTrue(config.is_valid, f"Config should be valid. Errors: {config.validation_errors}")
        
        # Check user service endpoints
        user_service = config.get_service("user-service")
        self.assertIn("GET /users", user_service.sample_endpoints)
        self.assertIn("POST /users", user_service.sample_endpoints)
        
        # Check transaction service endpoints
        txn_service = config.get_service("transaction-service")
        self.assertIn("GET /transactions", txn_service.sample_endpoints)
        
        # Check product service endpoints
        product_service = config.get_service("product-service")
        self.assertIn("GET /products", product_service.sample_endpoints)
        
        # Check custom service gets default endpoints
        custom_service = config.get_service("custom-service")
        self.assertIn("GET /health", custom_service.sample_endpoints)
        self.assertIn("GET /status", custom_service.sample_endpoints)


class TestConfigurationData(unittest.TestCase):
    """Test cases for ConfigurationData class."""
    
    def test_is_valid_with_no_errors(self):
        """Test that configuration is valid when there are no validation errors."""
        config = ConfigurationData(
            gateway=GatewayConfig(),
            services=[],
            validation_errors=[]
        )
        
        self.assertTrue(config.is_valid)
    
    def test_is_valid_with_errors(self):
        """Test that configuration is invalid when there are validation errors."""
        config = ConfigurationData(
            gateway=GatewayConfig(),
            services=[],
            validation_errors=[ValidationError("test", "test error")]
        )
        
        self.assertFalse(config.is_valid)
    
    def test_get_service_by_name(self):
        """Test getting service configuration by name."""
        service1 = ServiceConfig(name="service1", endpoint="http://service1:8080")
        service2 = ServiceConfig(name="service2", endpoint="http://service2:8080")
        
        config = ConfigurationData(
            gateway=GatewayConfig(),
            services=[service1, service2]
        )
        
        self.assertEqual(config.get_service("service1"), service1)
        self.assertEqual(config.get_service("service2"), service2)
        self.assertIsNone(config.get_service("nonexistent"))
    
    def test_get_service_names(self):
        """Test getting list of service names."""
        service1 = ServiceConfig(name="service1", endpoint="http://service1:8080")
        service2 = ServiceConfig(name="service2", endpoint="http://service2:8080")
        
        config = ConfigurationData(
            gateway=GatewayConfig(),
            services=[service1, service2]
        )
        
        names = config.get_service_names()
        self.assertEqual(set(names), {"service1", "service2"})


class TestValidationError(unittest.TestCase):
    """Test cases for ValidationError class."""
    
    def test_str_representation_with_value(self):
        """Test string representation with value."""
        error = ValidationError("field", "error message", "test_value")
        expected = "field: error message (got: test_value)"
        self.assertEqual(str(error), expected)
    
    def test_str_representation_without_value(self):
        """Test string representation without value."""
        error = ValidationError("field", "error message")
        expected = "field: error message"
        self.assertEqual(str(error), expected)


if __name__ == '__main__':
    unittest.main()