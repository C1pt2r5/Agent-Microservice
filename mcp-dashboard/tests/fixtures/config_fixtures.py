"""
Configuration fixtures for testing.
Provides various configuration scenarios for comprehensive testing.
"""
import tempfile
import os
from pathlib import Path
from typing import Dict, Any, Optional
from config.service_config import (
    ServiceConfig, GatewayConfig, ConfigurationData, ValidationError,
    AuthType, RetryConfig, CircuitBreakerConfig, RateLimitConfig,
    RetryStrategy
)


class ConfigFixtures:
    """Configuration fixtures for testing."""
    
    @staticmethod
    def create_temp_env_file(content: str) -> str:
        """Create a temporary .env file with given content."""
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.env', delete=False)
        temp_file.write(content)
        temp_file.close()
        return temp_file.name
    
    @staticmethod
    def cleanup_temp_file(file_path: str):
        """Clean up temporary file."""
        try:
            os.unlink(file_path)
        except OSError:
            pass
    
    @staticmethod
    def valid_basic_config() -> str:
        """Basic valid configuration."""
        return """
# MCP Gateway Configuration
MCP_GATEWAY_URL=http://localhost:8080
MCP_DEFAULT_TIMEOUT=30000
PORT=8080

# Services
MCP_SERVICES=user-service

# User Service Configuration
MCP_SERVICE_USER_SERVICE_ENDPOINT=http://user-service:8080
MCP_SERVICE_USER_SERVICE_AUTH_TYPE=none
MCP_SERVICE_USER_SERVICE_TIMEOUT=30000
"""
    
    @staticmethod
    def valid_comprehensive_config() -> str:
        """Comprehensive valid configuration with all features."""
        return """
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
MCP_SERVICES=user-service,transaction-service,product-service

# User Service Configuration
MCP_SERVICE_USER_SERVICE_ENDPOINT=http://user-service:8080
MCP_SERVICE_USER_SERVICE_AUTH_TYPE=bearer
MCP_SERVICE_USER_SERVICE_TOKEN=user_service_token_123
MCP_SERVICE_USER_SERVICE_TIMEOUT=30000
MCP_SERVICE_USER_SERVICE_RATE_LIMIT_RPM=100
MCP_SERVICE_USER_SERVICE_RATE_LIMIT_BURST=20
MCP_SERVICE_USER_SERVICE_CB_FAILURE_THRESHOLD=5
MCP_SERVICE_USER_SERVICE_CB_RECOVERY_TIMEOUT=30000
MCP_SERVICE_USER_SERVICE_CB_HALF_OPEN_MAX_CALLS=3

# Transaction Service Configuration
MCP_SERVICE_TRANSACTION_SERVICE_ENDPOINT=http://transaction-service:8080
MCP_SERVICE_TRANSACTION_SERVICE_AUTH_TYPE=api-key
MCP_SERVICE_TRANSACTION_SERVICE_API_KEY=txn_api_key_456
MCP_SERVICE_TRANSACTION_SERVICE_TIMEOUT=15000
MCP_SERVICE_TRANSACTION_SERVICE_RATE_LIMIT_RPM=50
MCP_SERVICE_TRANSACTION_SERVICE_RATE_LIMIT_BURST=10
MCP_SERVICE_TRANSACTION_SERVICE_CB_FAILURE_THRESHOLD=3
MCP_SERVICE_TRANSACTION_SERVICE_CB_RECOVERY_TIMEOUT=60000
MCP_SERVICE_TRANSACTION_SERVICE_CB_HALF_OPEN_MAX_CALLS=2

# Product Service Configuration
MCP_SERVICE_PRODUCT_SERVICE_ENDPOINT=http://product-service:8080
MCP_SERVICE_PRODUCT_SERVICE_AUTH_TYPE=oauth2
MCP_SERVICE_PRODUCT_SERVICE_ACCESS_TOKEN=oauth2_access_token_789
MCP_SERVICE_PRODUCT_SERVICE_TIMEOUT=20000
MCP_SERVICE_PRODUCT_SERVICE_RATE_LIMIT_RPM=200
MCP_SERVICE_PRODUCT_SERVICE_RATE_LIMIT_BURST=50
MCP_SERVICE_PRODUCT_SERVICE_CB_FAILURE_THRESHOLD=10
MCP_SERVICE_PRODUCT_SERVICE_CB_RECOVERY_TIMEOUT=45000
MCP_SERVICE_PRODUCT_SERVICE_CB_HALF_OPEN_MAX_CALLS=5
"""
    
    @staticmethod
    def invalid_missing_gateway_url() -> str:
        """Configuration missing gateway URL."""
        return """
# Missing MCP_GATEWAY_URL
MCP_DEFAULT_TIMEOUT=30000
PORT=8080

MCP_SERVICES=user-service
MCP_SERVICE_USER_SERVICE_ENDPOINT=http://user-service:8080
"""
    
    @staticmethod
    def invalid_missing_services() -> str:
        """Configuration with no services defined."""
        return """
MCP_GATEWAY_URL=http://localhost:8080
MCP_DEFAULT_TIMEOUT=30000
PORT=8080

# No MCP_SERVICES defined
"""
    
    @staticmethod
    def invalid_service_missing_endpoint() -> str:
        """Configuration with service missing endpoint."""
        return """
MCP_GATEWAY_URL=http://localhost:8080
MCP_SERVICES=user-service

# Missing MCP_SERVICE_USER_SERVICE_ENDPOINT
MCP_SERVICE_USER_SERVICE_AUTH_TYPE=none
"""
    
    @staticmethod
    def invalid_auth_missing_credentials() -> str:
        """Configuration with auth type but missing credentials."""
        return """
MCP_GATEWAY_URL=http://localhost:8080
MCP_SERVICES=user-service

MCP_SERVICE_USER_SERVICE_ENDPOINT=http://user-service:8080
MCP_SERVICE_USER_SERVICE_AUTH_TYPE=bearer
# Missing MCP_SERVICE_USER_SERVICE_TOKEN
"""
    
    @staticmethod
    def invalid_malformed_values() -> str:
        """Configuration with malformed values."""
        return """
MCP_GATEWAY_URL=not-a-valid-url
MCP_DEFAULT_TIMEOUT=not-a-number
PORT=99999

MCP_RETRY_MAX_ATTEMPTS=not-a-number
MCP_RETRY_STRATEGY=invalid-strategy

MCP_SERVICES=user-service
MCP_SERVICE_USER_SERVICE_ENDPOINT=also-not-a-url
MCP_SERVICE_USER_SERVICE_AUTH_TYPE=invalid-auth-type
MCP_SERVICE_USER_SERVICE_TIMEOUT=negative-timeout
"""
    
    @staticmethod
    def config_with_comments_and_empty_lines() -> str:
        """Configuration with comments and empty lines."""
        return """
# This is a comment
# MCP Gateway Configuration

MCP_GATEWAY_URL=http://localhost:8080

# Another comment
MCP_DEFAULT_TIMEOUT=30000
PORT=8080

# Services section
MCP_SERVICES=user-service

# User service configuration
MCP_SERVICE_USER_SERVICE_ENDPOINT=http://user-service:8080
MCP_SERVICE_USER_SERVICE_AUTH_TYPE=none

# End of configuration
"""
    
    @staticmethod
    def config_with_quoted_values() -> str:
        """Configuration with quoted values."""
        return """
MCP_GATEWAY_URL="http://localhost:8080"
MCP_SERVICES='user-service,transaction-service'

MCP_SERVICE_USER_SERVICE_ENDPOINT="http://user-service:8080"
MCP_SERVICE_USER_SERVICE_AUTH_TYPE='bearer'
MCP_SERVICE_USER_SERVICE_TOKEN="quoted_token_value"

MCP_SERVICE_TRANSACTION_SERVICE_ENDPOINT='http://transaction-service:8080'
MCP_SERVICE_TRANSACTION_SERVICE_AUTH_TYPE="api-key"
MCP_SERVICE_TRANSACTION_SERVICE_API_KEY='quoted_api_key'
"""
    
    @staticmethod
    def config_with_environment_variables() -> str:
        """Configuration using environment variable substitution."""
        return """
MCP_GATEWAY_URL=${GATEWAY_URL:-http://localhost:8080}
MCP_DEFAULT_TIMEOUT=${DEFAULT_TIMEOUT:-30000}

MCP_SERVICES=user-service
MCP_SERVICE_USER_SERVICE_ENDPOINT=${USER_SERVICE_URL:-http://user-service:8080}
MCP_SERVICE_USER_SERVICE_TOKEN=${USER_SERVICE_TOKEN:-default_token}
"""
    
    @staticmethod
    def create_service_config(name: str = "test-service", **overrides) -> ServiceConfig:
        """Create a test service configuration."""
        defaults = {
            'name': name,
            'endpoint': f'http://{name}:8080',
            'auth_type': AuthType.NONE,
            'timeout': 30000,
            'retry_config': RetryConfig(),
            'circuit_breaker': CircuitBreakerConfig(),
            'rate_limit': RateLimitConfig(),
            'sample_endpoints': [
                f'GET /{name.replace("-", "")}',
                f'POST /{name.replace("-", "")}',
                'GET /health'
            ]
        }
        defaults.update(overrides)
        return ServiceConfig(**defaults)
    
    @staticmethod
    def create_gateway_config(**overrides) -> GatewayConfig:
        """Create a test gateway configuration."""
        defaults = {
            'url': 'http://localhost:8080',
            'port': 8080,
            'default_timeout': 30000,
            'retry_config': RetryConfig()
        }
        defaults.update(overrides)
        return GatewayConfig(**defaults)
    
    @staticmethod
    def create_configuration_data(
        services: Optional[list] = None,
        gateway: Optional[GatewayConfig] = None,
        validation_errors: Optional[list] = None
    ) -> ConfigurationData:
        """Create test configuration data."""
        if services is None:
            services = [ConfigFixtures.create_service_config()]
        if gateway is None:
            gateway = ConfigFixtures.create_gateway_config()
        if validation_errors is None:
            validation_errors = []
        
        return ConfigurationData(
            gateway=gateway,
            services=services,
            validation_errors=validation_errors
        )
    
    @staticmethod
    def create_retry_config(**overrides) -> RetryConfig:
        """Create test retry configuration."""
        defaults = {
            'max_attempts': 3,
            'strategy': RetryStrategy.EXPONENTIAL,
            'initial_delay': 1000,
            'max_delay': 30000,
            'jitter': True
        }
        defaults.update(overrides)
        return RetryConfig(**defaults)
    
    @staticmethod
    def create_circuit_breaker_config(**overrides) -> CircuitBreakerConfig:
        """Create test circuit breaker configuration."""
        defaults = {
            'failure_threshold': 5,
            'recovery_timeout': 30000,
            'half_open_max_calls': 3
        }
        defaults.update(overrides)
        return CircuitBreakerConfig(**defaults)
    
    @staticmethod
    def create_rate_limit_config(**overrides) -> RateLimitConfig:
        """Create test rate limit configuration."""
        defaults = {
            'requests_per_minute': 100,
            'burst_limit': 20
        }
        defaults.update(overrides)
        return RateLimitConfig(**defaults)


class ConfigScenarios:
    """Pre-defined configuration scenarios for testing."""
    
    @staticmethod
    def minimal_working_config():
        """Minimal configuration that should work."""
        return ConfigFixtures.create_configuration_data(
            services=[ConfigFixtures.create_service_config("minimal-service")],
            gateway=ConfigFixtures.create_gateway_config()
        )
    
    @staticmethod
    def multi_service_config():
        """Configuration with multiple services."""
        services = [
            ConfigFixtures.create_service_config(
                "user-service",
                auth_type=AuthType.BEARER,
                token="user_token"
            ),
            ConfigFixtures.create_service_config(
                "transaction-service",
                auth_type=AuthType.API_KEY,
                api_key="txn_api_key"
            ),
            ConfigFixtures.create_service_config(
                "product-service",
                auth_type=AuthType.OAUTH2,
                access_token="oauth_token"
            )
        ]
        
        return ConfigFixtures.create_configuration_data(services=services)
    
    @staticmethod
    def config_with_validation_errors():
        """Configuration with validation errors."""
        validation_errors = [
            ValidationError("MCP_GATEWAY_URL", "Invalid URL format"),
            ValidationError("MCP_SERVICE_TEST_ENDPOINT", "Missing required field"),
            ValidationError("PORT", "Port must be between 1 and 65535")
        ]
        
        return ConfigFixtures.create_configuration_data(
            validation_errors=validation_errors
        )
    
    @staticmethod
    def high_performance_config():
        """Configuration optimized for high performance."""
        services = [
            ConfigFixtures.create_service_config(
                "high-perf-service",
                timeout=5000,  # Short timeout
                retry_config=ConfigFixtures.create_retry_config(
                    max_attempts=2,
                    strategy=RetryStrategy.FIXED,
                    initial_delay=500
                ),
                circuit_breaker=ConfigFixtures.create_circuit_breaker_config(
                    failure_threshold=3,
                    recovery_timeout=10000
                ),
                rate_limit=ConfigFixtures.create_rate_limit_config(
                    requests_per_minute=1000,
                    burst_limit=100
                )
            )
        ]
        
        gateway = ConfigFixtures.create_gateway_config(
            default_timeout=5000,
            retry_config=ConfigFixtures.create_retry_config(
                max_attempts=2,
                initial_delay=500
            )
        )
        
        return ConfigFixtures.create_configuration_data(
            services=services,
            gateway=gateway
        )
    
    @staticmethod
    def resilient_config():
        """Configuration optimized for resilience."""
        services = [
            ConfigFixtures.create_service_config(
                "resilient-service",
                timeout=60000,  # Long timeout
                retry_config=ConfigFixtures.create_retry_config(
                    max_attempts=5,
                    strategy=RetryStrategy.EXPONENTIAL,
                    initial_delay=2000,
                    max_delay=60000
                ),
                circuit_breaker=ConfigFixtures.create_circuit_breaker_config(
                    failure_threshold=10,
                    recovery_timeout=60000,
                    half_open_max_calls=5
                )
            )
        ]
        
        return ConfigFixtures.create_configuration_data(services=services)


# Environment variable fixtures
ENV_FIXTURES = {
    'VALID_BASIC': {
        'MCP_GATEWAY_URL': 'http://localhost:8080',
        'MCP_SERVICES': 'user-service',
        'MCP_SERVICE_USER_SERVICE_ENDPOINT': 'http://user-service:8080'
    },
    
    'VALID_COMPREHENSIVE': {
        'MCP_GATEWAY_URL': 'http://localhost:8080',
        'MCP_DEFAULT_TIMEOUT': '30000',
        'PORT': '8080',
        'MCP_RETRY_MAX_ATTEMPTS': '3',
        'MCP_RETRY_STRATEGY': 'exponential',
        'MCP_SERVICES': 'user-service,transaction-service',
        'MCP_SERVICE_USER_SERVICE_ENDPOINT': 'http://user-service:8080',
        'MCP_SERVICE_USER_SERVICE_AUTH_TYPE': 'bearer',
        'MCP_SERVICE_USER_SERVICE_TOKEN': 'test_token',
        'MCP_SERVICE_TRANSACTION_SERVICE_ENDPOINT': 'http://transaction-service:8080',
        'MCP_SERVICE_TRANSACTION_SERVICE_AUTH_TYPE': 'api-key',
        'MCP_SERVICE_TRANSACTION_SERVICE_API_KEY': 'test_api_key'
    },
    
    'INVALID_MISSING_SERVICES': {
        'MCP_GATEWAY_URL': 'http://localhost:8080'
        # Missing MCP_SERVICES
    },
    
    'INVALID_MALFORMED': {
        'MCP_GATEWAY_URL': 'not-a-url',
        'MCP_SERVICES': 'test-service',
        'MCP_SERVICE_TEST_SERVICE_ENDPOINT': 'also-not-a-url',
        'MCP_SERVICE_TEST_SERVICE_TIMEOUT': 'not-a-number'
    }
}