"""
Data classes for service and gateway configuration.
"""
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from enum import Enum


class AuthType(Enum):
    """Supported authentication types."""
    BEARER = "bearer"
    API_KEY = "api-key"
    OAUTH2 = "oauth2"
    NONE = "none"


class RetryStrategy(Enum):
    """Supported retry strategies."""
    EXPONENTIAL = "exponential"
    LINEAR = "linear"
    FIXED = "fixed"


@dataclass
class RetryConfig:
    """Configuration for retry logic."""
    max_attempts: int = 3
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL
    initial_delay: int = 1000  # milliseconds
    max_delay: int = 30000  # milliseconds
    jitter: bool = True


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker pattern."""
    failure_threshold: int = 5
    recovery_timeout: int = 30000  # milliseconds
    half_open_max_calls: int = 3


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    requests_per_minute: int = 100
    burst_limit: int = 20


@dataclass
class ServiceConfig:
    """Configuration for an individual service."""
    name: str
    endpoint: str
    auth_type: AuthType = AuthType.NONE
    timeout: int = 30000  # milliseconds
    
    # Authentication credentials
    token: Optional[str] = None
    api_key: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    
    # Rate limiting
    rate_limit: Optional[RateLimitConfig] = None
    
    # Circuit breaker configuration
    circuit_breaker: Optional[CircuitBreakerConfig] = None
    
    # Sample endpoints for testing
    sample_endpoints: List[str] = None
    
    def __post_init__(self):
        """Initialize default values after object creation."""
        if self.sample_endpoints is None:
            self.sample_endpoints = []
        
        if self.rate_limit is None:
            self.rate_limit = RateLimitConfig()
        
        if self.circuit_breaker is None:
            self.circuit_breaker = CircuitBreakerConfig()


@dataclass
class GatewayConfig:
    """Configuration for the MCP Gateway."""
    url: str = "http://localhost:8080"
    port: int = 8080
    default_timeout: int = 30000  # milliseconds
    retry_config: Optional[RetryConfig] = None
    
    def __post_init__(self):
        """Initialize default values after object creation."""
        if self.retry_config is None:
            self.retry_config = RetryConfig()


@dataclass
class ValidationError:
    """Represents a configuration validation error."""
    field: str
    message: str
    value: Optional[Any] = None
    
    def __str__(self) -> str:
        """String representation of the validation error."""
        if self.value is not None:
            return f"{self.field}: {self.message} (got: {self.value})"
        return f"{self.field}: {self.message}"


@dataclass
class ConfigurationData:
    """Complete configuration data structure."""
    gateway: GatewayConfig
    services: List[ServiceConfig]
    validation_errors: List[ValidationError] = None
    
    def __post_init__(self):
        """Initialize default values after object creation."""
        if self.validation_errors is None:
            self.validation_errors = []
    
    @property
    def is_valid(self) -> bool:
        """Check if configuration is valid."""
        return len(self.validation_errors) == 0
    
    def get_service(self, name: str) -> Optional[ServiceConfig]:
        """Get service configuration by name."""
        for service in self.services:
            if service.name == name:
                return service
        return None
    
    def get_service_names(self) -> List[str]:
        """Get list of all service names."""
        return [service.name for service in self.services]