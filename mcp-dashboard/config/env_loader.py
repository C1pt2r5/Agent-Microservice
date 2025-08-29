"""
Environment configuration loader for MCP Dashboard.
Parses .env files and creates configuration objects.
"""
import os
import re
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path

from .service_config import (
    ServiceConfig, GatewayConfig, RetryConfig, CircuitBreakerConfig,
    RateLimitConfig, ConfigurationData, ValidationError,
    AuthType, RetryStrategy
)
from .sample_endpoint_loader import get_sample_endpoint_loader


class EnvLoader:
    """Loads and parses environment configuration files."""
    
    def __init__(self):
        """Initialize the environment loader."""
        self._env_data: Dict[str, str] = {}
        self._validation_errors: List[ValidationError] = []
    
    def load_config(self, env_path: str) -> ConfigurationData:
        """
        Load configuration from environment file.
        
        Args:
            env_path: Path to the .env file
            
        Returns:
            ConfigurationData object with parsed configuration
        """
        self._validation_errors.clear()
        
        # Load environment variables from file
        if not self._load_env_file(env_path):
            return ConfigurationData(
                gateway=GatewayConfig(),
                services=[],
                validation_errors=self._validation_errors
            )
        
        # Parse gateway configuration
        gateway_config = self._parse_gateway_config()
        
        # Parse service configurations
        services = self._parse_services_config()
        
        # Load sample endpoints from environment
        sample_endpoint_loader = get_sample_endpoint_loader()
        sample_endpoints = sample_endpoint_loader.load_from_environment(self._env_data)
        
        return ConfigurationData(
            gateway=gateway_config,
            services=services,
            validation_errors=self._validation_errors
        )
    
    def _load_env_file(self, env_path: str) -> bool:
        """
        Load environment variables from file.
        
        Args:
            env_path: Path to the .env file
            
        Returns:
            True if file was loaded successfully, False otherwise
        """
        try:
            env_file = Path(env_path)
            if not env_file.exists():
                self._validation_errors.append(
                    ValidationError("file", f"Environment file not found: {env_path}")
                )
                return False
            
            with open(env_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    
                    # Skip empty lines and comments
                    if not line or line.startswith('#'):
                        continue
                    
                    # Parse key=value pairs
                    if '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Remove quotes if present
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        elif value.startswith("'") and value.endswith("'"):
                            value = value[1:-1]
                        
                        self._env_data[key] = value
                    else:
                        self._validation_errors.append(
                            ValidationError(
                                f"line_{line_num}",
                                f"Invalid line format: {line}"
                            )
                        )
            
            return True
            
        except Exception as e:
            self._validation_errors.append(
                ValidationError("file", f"Error reading environment file: {str(e)}")
            )
            return False
    
    def _parse_gateway_config(self) -> GatewayConfig:
        """Parse gateway configuration from environment variables."""
        gateway_config = GatewayConfig()
        
        # Parse gateway URL
        if 'MCP_GATEWAY_URL' in self._env_data:
            gateway_config.url = self._env_data['MCP_GATEWAY_URL']
            if not self._validate_url(gateway_config.url):
                self._validation_errors.append(
                    ValidationError(
                        "MCP_GATEWAY_URL",
                        "Invalid URL format",
                        gateway_config.url
                    )
                )
        
        # Parse port
        if 'PORT' in self._env_data:
            try:
                gateway_config.port = int(self._env_data['PORT'])
                if not (1 <= gateway_config.port <= 65535):
                    self._validation_errors.append(
                        ValidationError(
                            "PORT",
                            "Port must be between 1 and 65535",
                            gateway_config.port
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        "PORT",
                        "Port must be a valid integer",
                        self._env_data['PORT']
                    )
                )
        
        # Parse default timeout
        if 'MCP_DEFAULT_TIMEOUT' in self._env_data:
            try:
                gateway_config.default_timeout = int(self._env_data['MCP_DEFAULT_TIMEOUT'])
                if gateway_config.default_timeout <= 0:
                    self._validation_errors.append(
                        ValidationError(
                            "MCP_DEFAULT_TIMEOUT",
                            "Timeout must be positive",
                            gateway_config.default_timeout
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        "MCP_DEFAULT_TIMEOUT",
                        "Timeout must be a valid integer",
                        self._env_data['MCP_DEFAULT_TIMEOUT']
                    )
                )
        
        # Parse retry configuration
        gateway_config.retry_config = self._parse_retry_config("MCP_RETRY_")
        
        return gateway_config
    
    def _parse_services_config(self) -> List[ServiceConfig]:
        """Parse service configurations from environment variables."""
        services = []
        
        # Get list of services
        services_str = self._env_data.get('MCP_SERVICES', '')
        if not services_str:
            self._validation_errors.append(
                ValidationError("MCP_SERVICES", "No services configured")
            )
            return services
        
        service_names = [name.strip() for name in services_str.split(',')]
        
        for service_name in service_names:
            if not service_name:
                continue
            
            service_config = self._parse_service_config(service_name)
            if service_config:
                services.append(service_config)
        
        return services
    
    def _parse_service_config(self, service_name: str) -> Optional[ServiceConfig]:
        """Parse configuration for a specific service."""
        # Convert service name to environment variable format
        env_prefix = f"MCP_SERVICE_{service_name.upper().replace('-', '_')}_"
        
        # Check if service has any configuration
        service_keys = [key for key in self._env_data.keys() if key.startswith(env_prefix)]
        if not service_keys:
            self._validation_errors.append(
                ValidationError(
                    service_name,
                    f"No configuration found for service: {service_name}"
                )
            )
            return None
        
        service_config = ServiceConfig(name=service_name, endpoint="")
        
        # Parse endpoint (required)
        endpoint_key = f"{env_prefix}ENDPOINT"
        if endpoint_key in self._env_data:
            service_config.endpoint = self._env_data[endpoint_key]
            if not self._validate_url(service_config.endpoint):
                self._validation_errors.append(
                    ValidationError(
                        endpoint_key,
                        "Invalid endpoint URL format",
                        service_config.endpoint
                    )
                )
        else:
            self._validation_errors.append(
                ValidationError(
                    endpoint_key,
                    f"Missing required endpoint for service: {service_name}"
                )
            )
            return None
        
        # Parse authentication type
        auth_type_key = f"{env_prefix}AUTH_TYPE"
        if auth_type_key in self._env_data:
            try:
                service_config.auth_type = AuthType(self._env_data[auth_type_key])
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        auth_type_key,
                        f"Invalid auth type. Must be one of: {[e.value for e in AuthType]}",
                        self._env_data[auth_type_key]
                    )
                )
        
        # Parse authentication credentials based on auth type
        self._parse_auth_credentials(service_config, env_prefix)
        
        # Parse timeout
        timeout_key = f"{env_prefix}TIMEOUT"
        if timeout_key in self._env_data:
            try:
                service_config.timeout = int(self._env_data[timeout_key])
                if service_config.timeout <= 0:
                    self._validation_errors.append(
                        ValidationError(
                            timeout_key,
                            "Timeout must be positive",
                            service_config.timeout
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        timeout_key,
                        "Timeout must be a valid integer",
                        self._env_data[timeout_key]
                    )
                )
        
        # Parse rate limiting configuration
        service_config.rate_limit = self._parse_rate_limit_config(env_prefix)
        
        # Parse circuit breaker configuration
        service_config.circuit_breaker = self._parse_circuit_breaker_config(env_prefix)
        
        # Add default sample endpoints based on service type
        service_config.sample_endpoints = self._get_default_sample_endpoints(service_name)
        
        return service_config
    
    def _parse_auth_credentials(self, service_config: ServiceConfig, env_prefix: str):
        """Parse authentication credentials for a service."""
        if service_config.auth_type == AuthType.BEARER:
            token_key = f"{env_prefix}TOKEN"
            if token_key in self._env_data:
                service_config.token = self._env_data[token_key]
            else:
                self._validation_errors.append(
                    ValidationError(
                        token_key,
                        f"Missing token for bearer auth service: {service_config.name}"
                    )
                )
        
        elif service_config.auth_type == AuthType.API_KEY:
            api_key_key = f"{env_prefix}API_KEY"
            if api_key_key in self._env_data:
                service_config.api_key = self._env_data[api_key_key]
            else:
                self._validation_errors.append(
                    ValidationError(
                        api_key_key,
                        f"Missing API key for api-key auth service: {service_config.name}"
                    )
                )
        
        elif service_config.auth_type == AuthType.OAUTH2:
            access_token_key = f"{env_prefix}ACCESS_TOKEN"
            refresh_token_key = f"{env_prefix}REFRESH_TOKEN"
            
            if access_token_key in self._env_data:
                service_config.access_token = self._env_data[access_token_key]
            else:
                self._validation_errors.append(
                    ValidationError(
                        access_token_key,
                        f"Missing access token for OAuth2 service: {service_config.name}"
                    )
                )
            
            if refresh_token_key in self._env_data:
                service_config.refresh_token = self._env_data[refresh_token_key]
    
    def _parse_retry_config(self, prefix: str) -> RetryConfig:
        """Parse retry configuration from environment variables."""
        retry_config = RetryConfig()
        
        # Parse max attempts
        max_attempts_key = f"{prefix}MAX_ATTEMPTS"
        if max_attempts_key in self._env_data:
            try:
                retry_config.max_attempts = int(self._env_data[max_attempts_key])
                if retry_config.max_attempts < 0:
                    self._validation_errors.append(
                        ValidationError(
                            max_attempts_key,
                            "Max attempts must be non-negative",
                            retry_config.max_attempts
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        max_attempts_key,
                        "Max attempts must be a valid integer",
                        self._env_data[max_attempts_key]
                    )
                )
        
        # Parse strategy
        strategy_key = f"{prefix}STRATEGY"
        if strategy_key in self._env_data:
            try:
                retry_config.strategy = RetryStrategy(self._env_data[strategy_key])
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        strategy_key,
                        f"Invalid retry strategy. Must be one of: {[e.value for e in RetryStrategy]}",
                        self._env_data[strategy_key]
                    )
                )
        
        # Parse initial delay
        initial_delay_key = f"{prefix}INITIAL_DELAY"
        if initial_delay_key in self._env_data:
            try:
                retry_config.initial_delay = int(self._env_data[initial_delay_key])
                if retry_config.initial_delay <= 0:
                    self._validation_errors.append(
                        ValidationError(
                            initial_delay_key,
                            "Initial delay must be positive",
                            retry_config.initial_delay
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        initial_delay_key,
                        "Initial delay must be a valid integer",
                        self._env_data[initial_delay_key]
                    )
                )
        
        # Parse max delay
        max_delay_key = f"{prefix}MAX_DELAY"
        if max_delay_key in self._env_data:
            try:
                retry_config.max_delay = int(self._env_data[max_delay_key])
                if retry_config.max_delay <= 0:
                    self._validation_errors.append(
                        ValidationError(
                            max_delay_key,
                            "Max delay must be positive",
                            retry_config.max_delay
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        max_delay_key,
                        "Max delay must be a valid integer",
                        self._env_data[max_delay_key]
                    )
                )
        
        # Parse jitter
        jitter_key = f"{prefix}JITTER"
        if jitter_key in self._env_data:
            jitter_value = self._env_data[jitter_key].lower()
            if jitter_value in ('true', '1', 'yes', 'on'):
                retry_config.jitter = True
            elif jitter_value in ('false', '0', 'no', 'off'):
                retry_config.jitter = False
            else:
                self._validation_errors.append(
                    ValidationError(
                        jitter_key,
                        "Jitter must be a boolean value (true/false)",
                        self._env_data[jitter_key]
                    )
                )
        
        return retry_config
    
    def _parse_rate_limit_config(self, env_prefix: str) -> RateLimitConfig:
        """Parse rate limiting configuration."""
        rate_limit = RateLimitConfig()
        
        # Parse requests per minute
        rpm_key = f"{env_prefix}RATE_LIMIT_RPM"
        if rpm_key in self._env_data:
            try:
                rate_limit.requests_per_minute = int(self._env_data[rpm_key])
                if rate_limit.requests_per_minute <= 0:
                    self._validation_errors.append(
                        ValidationError(
                            rpm_key,
                            "Requests per minute must be positive",
                            rate_limit.requests_per_minute
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        rpm_key,
                        "Requests per minute must be a valid integer",
                        self._env_data[rpm_key]
                    )
                )
        
        # Parse burst limit
        burst_key = f"{env_prefix}RATE_LIMIT_BURST"
        if burst_key in self._env_data:
            try:
                rate_limit.burst_limit = int(self._env_data[burst_key])
                if rate_limit.burst_limit <= 0:
                    self._validation_errors.append(
                        ValidationError(
                            burst_key,
                            "Burst limit must be positive",
                            rate_limit.burst_limit
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        burst_key,
                        "Burst limit must be a valid integer",
                        self._env_data[burst_key]
                    )
                )
        
        return rate_limit
    
    def _parse_circuit_breaker_config(self, env_prefix: str) -> CircuitBreakerConfig:
        """Parse circuit breaker configuration."""
        cb_config = CircuitBreakerConfig()
        
        # Parse failure threshold
        threshold_key = f"{env_prefix}CB_FAILURE_THRESHOLD"
        if threshold_key in self._env_data:
            try:
                cb_config.failure_threshold = int(self._env_data[threshold_key])
                if cb_config.failure_threshold <= 0:
                    self._validation_errors.append(
                        ValidationError(
                            threshold_key,
                            "Failure threshold must be positive",
                            cb_config.failure_threshold
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        threshold_key,
                        "Failure threshold must be a valid integer",
                        self._env_data[threshold_key]
                    )
                )
        
        # Parse recovery timeout
        recovery_key = f"{env_prefix}CB_RECOVERY_TIMEOUT"
        if recovery_key in self._env_data:
            try:
                cb_config.recovery_timeout = int(self._env_data[recovery_key])
                if cb_config.recovery_timeout <= 0:
                    self._validation_errors.append(
                        ValidationError(
                            recovery_key,
                            "Recovery timeout must be positive",
                            cb_config.recovery_timeout
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        recovery_key,
                        "Recovery timeout must be a valid integer",
                        self._env_data[recovery_key]
                    )
                )
        
        # Parse half-open max calls
        half_open_key = f"{env_prefix}CB_HALF_OPEN_MAX_CALLS"
        if half_open_key in self._env_data:
            try:
                cb_config.half_open_max_calls = int(self._env_data[half_open_key])
                if cb_config.half_open_max_calls <= 0:
                    self._validation_errors.append(
                        ValidationError(
                            half_open_key,
                            "Half-open max calls must be positive",
                            cb_config.half_open_max_calls
                        )
                    )
            except ValueError:
                self._validation_errors.append(
                    ValidationError(
                        half_open_key,
                        "Half-open max calls must be a valid integer",
                        self._env_data[half_open_key]
                    )
                )
        
        return cb_config
    
    def _get_default_sample_endpoints(self, service_name: str) -> List[str]:
        """Get default sample endpoints based on service name."""
        service_type = service_name.lower().replace('-', '_')
        
        if 'user' in service_type:
            return [
                "GET /users",
                "GET /users/{id}",
                "POST /users",
                "PUT /users/{id}",
                "DELETE /users/{id}"
            ]
        elif 'transaction' in service_type:
            return [
                "GET /transactions",
                "GET /transactions/{id}",
                "POST /transactions",
                "GET /transactions/user/{userId}"
            ]
        elif 'product' in service_type:
            return [
                "GET /products",
                "GET /products/{id}",
                "POST /products",
                "PUT /products/{id}",
                "DELETE /products/{id}"
            ]
        else:
            return [
                "GET /health",
                "GET /status"
            ]
    
    def _validate_url(self, url: str) -> bool:
        """Validate URL format."""
        if not url:
            return False
        
        # Basic URL validation - more permissive for service names and hostnames
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:'
            r'(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?|'  # hostname without domain (e.g., user-service)
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'  # ...or ip
            r')'
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)?$', re.IGNORECASE)  # optional path
        
        return url_pattern.match(url) is not None
    
    def get_services(self, config_data: ConfigurationData) -> List[ServiceConfig]:
        """Get list of service configurations."""
        return config_data.services
    
    def get_gateway_config(self, config_data: ConfigurationData) -> GatewayConfig:
        """Get gateway configuration."""
        return config_data.gateway
    
    def validate_config(self, config_data: ConfigurationData) -> List[ValidationError]:
        """Get list of validation errors."""
        return config_data.validation_errors