"""
Service management layer that coordinates business logic between UI and network layers.
Handles dynamic service discovery, request execution coordination, and sample endpoint management.
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from datetime import datetime

from config.env_loader import EnvLoader
from config.service_config import ServiceConfig, ConfigurationData, ValidationError
from config.sample_endpoints import get_sample_endpoint_provider, SampleEndpoint
from .http_client import HttpClient, RequestResult
from .health_checker import HealthChecker, ServiceHealthInfo


@dataclass
class EndpointInfo:
    """Information about a service endpoint."""
    path: str
    method: str
    description: str
    sample_payload: Optional[Dict[str, Any]] = None
    
    def __str__(self) -> str:
        """String representation of endpoint info."""
        return f"{self.method} {self.path}"


@dataclass
class ServiceExecutionResult:
    """Result of service request execution."""
    service_name: str
    endpoint: str
    method: str
    success: bool
    request_result: RequestResult
    execution_time: datetime
    
    @property
    def status_code(self) -> int:
        """Get HTTP status code from request result."""
        return self.request_result.status_code
    
    @property
    def response_data(self) -> Dict[str, Any]:
        """Get response data from request result."""
        return self.request_result.response_data
    
    @property
    def error_message(self) -> Optional[str]:
        """Get error message from request result."""
        return self.request_result.error_message
    
    @property
    def response_time(self) -> float:
        """Get response time from request result."""
        return self.request_result.response_time


class ServiceManager:
    """
    Service management layer that coordinates business logic.
    
    Manages dynamic service discovery from configuration, coordinates request execution
    between UI and network layers, and provides sample endpoint management.
    """
    
    def __init__(self, config_loader: EnvLoader):
        """
        Initialize service manager with configuration loader.
        
        Args:
            config_loader: Environment configuration loader
        """
        self.config_loader = config_loader
        self.logger = logging.getLogger("ServiceManager")
        
        # Configuration and services
        self._config_data: Optional[ConfigurationData] = None
        self._services: Dict[str, ServiceConfig] = {}
        self._http_clients: Dict[str, HttpClient] = {}
        
        # Health monitoring
        self._health_checker: Optional[HealthChecker] = None
        
        # Sample endpoints cache and provider
        self._sample_endpoints_cache: Dict[str, List[EndpointInfo]] = {}
        self._sample_endpoint_provider = get_sample_endpoint_provider()
        
        # Status callbacks
        self._status_callbacks: List[Callable[[str, ServiceHealthInfo], None]] = []
    
    async def initialize(self, env_path: str) -> bool:
        """
        Initialize service manager with configuration from environment file.
        
        Args:
            env_path: Path to environment configuration file
            
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            # Load configuration
            self._config_data = self.config_loader.load_config(env_path)
            
            if not self._config_data.is_valid:
                self.logger.error("Configuration validation failed:")
                for error in self._config_data.validation_errors:
                    self.logger.error(f"  - {error}")
                return False
            
            # Initialize services
            self._services.clear()
            self._http_clients.clear()
            self._sample_endpoints_cache.clear()
            
            for service in self._config_data.services:
                self._services[service.name] = service
                self._http_clients[service.name] = HttpClient(service)
                self.logger.info(f"Initialized service: {service.name} -> {service.endpoint}")
            
            # Initialize health checker
            if self._health_checker:
                await self._health_checker.stop_monitoring()
            
            self._health_checker = HealthChecker(self._config_data.services)
            
            # Add existing status callbacks to health checker
            for callback in self._status_callbacks:
                self._health_checker.add_status_callback(callback)
            
            # Start health monitoring
            await self._health_checker.start_monitoring()
            
            self.logger.info(f"Service manager initialized with {len(self._services)} services")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize service manager: {e}")
            return False
    
    def get_available_services(self) -> List[ServiceConfig]:
        """
        Get list of available service configurations.
        
        Returns:
            List of service configurations
        """
        return list(self._services.values())
    
    def get_service_names(self) -> List[str]:
        """
        Get list of available service names.
        
        Returns:
            List of service names
        """
        return list(self._services.keys())
    
    def get_service_config(self, service_name: str) -> Optional[ServiceConfig]:
        """
        Get configuration for a specific service.
        
        Args:
            service_name: Name of the service
            
        Returns:
            ServiceConfig if service exists, None otherwise
        """
        return self._services.get(service_name)
    
    async def execute_request(
        self, 
        service_name: str, 
        endpoint: str, 
        method: str = 'GET',
        **kwargs
    ) -> ServiceExecutionResult:
        """
        Execute a request to a specific service endpoint.
        
        Args:
            service_name: Name of the target service
            endpoint: API endpoint path
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            **kwargs: Additional arguments for the request
            
        Returns:
            ServiceExecutionResult with request outcome
        """
        execution_time = datetime.now()
        
        # Validate service exists
        if service_name not in self._services:
            error_result = RequestResult(
                success=False,
                status_code=404,
                response_data={},
                response_time=0,
                error_message=f"Service '{service_name}' not found"
            )
            return ServiceExecutionResult(
                service_name=service_name,
                endpoint=endpoint,
                method=method,
                success=False,
                request_result=error_result,
                execution_time=execution_time
            )
        
        try:
            # Get HTTP client for the service
            http_client = self._http_clients[service_name]
            
            # Execute the request
            self.logger.info(f"Executing {method} {endpoint} on service {service_name}")
            
            async with http_client:
                request_result = await http_client.make_request(method, endpoint, **kwargs)
            
            self.logger.info(
                f"Request completed: {service_name} {method} {endpoint} -> "
                f"Status: {request_result.status_code}, "
                f"Success: {request_result.success}, "
                f"Time: {request_result.response_time:.2f}ms"
            )
            
            return ServiceExecutionResult(
                service_name=service_name,
                endpoint=endpoint,
                method=method,
                success=request_result.success,
                request_result=request_result,
                execution_time=execution_time
            )
            
        except Exception as e:
            self.logger.error(f"Error executing request to {service_name}: {e}")
            
            error_result = RequestResult(
                success=False,
                status_code=500,
                response_data={},
                response_time=0,
                error_message=f"Execution error: {str(e)}"
            )
            
            return ServiceExecutionResult(
                service_name=service_name,
                endpoint=endpoint,
                method=method,
                success=False,
                request_result=error_result,
                execution_time=execution_time
            )
    
    def get_sample_endpoints(self, service_name: str) -> List[EndpointInfo]:
        """
        Get sample endpoints for a specific service.
        
        Args:
            service_name: Name of the service
            
        Returns:
            List of EndpointInfo objects for sample endpoints
        """
        # Check cache first
        if service_name in self._sample_endpoints_cache:
            return self._sample_endpoints_cache[service_name]
        
        # Get comprehensive sample endpoints from provider
        sample_endpoints = self._sample_endpoint_provider.get_endpoints_for_service(service_name)
        
        # Convert SampleEndpoint objects to EndpointInfo objects
        endpoint_infos = []
        for sample_endpoint in sample_endpoints:
            endpoint_info = EndpointInfo(
                path=sample_endpoint.path,
                method=sample_endpoint.method,
                description=sample_endpoint.description,
                sample_payload=sample_endpoint.sample_payload
            )
            endpoint_infos.append(endpoint_info)
        
        # If no comprehensive endpoints found, fall back to service config
        if not endpoint_infos:
            service_config = self._services.get(service_name)
            if service_config and service_config.sample_endpoints:
                for endpoint_str in service_config.sample_endpoints:
                    endpoint_info = self._parse_endpoint_string(endpoint_str, service_name)
                    if endpoint_info:
                        endpoint_infos.append(endpoint_info)
        
        # Cache the results
        self._sample_endpoints_cache[service_name] = endpoint_infos
        
        return endpoint_infos
    
    def _parse_endpoint_string(self, endpoint_str: str, service_name: str) -> Optional[EndpointInfo]:
        """
        Parse endpoint string into EndpointInfo object.
        
        Args:
            endpoint_str: Endpoint string in format "METHOD /path"
            service_name: Name of the service for context
            
        Returns:
            EndpointInfo object or None if parsing fails
        """
        try:
            parts = endpoint_str.strip().split(' ', 1)
            if len(parts) != 2:
                self.logger.warning(f"Invalid endpoint format: {endpoint_str}")
                return None
            
            method, path = parts
            method = method.upper()
            
            # Generate description based on method and path
            description = self._generate_endpoint_description(method, path, service_name)
            
            # Generate sample payload for POST/PUT requests
            sample_payload = None
            if method in ['POST', 'PUT', 'PATCH']:
                sample_payload = self._generate_sample_payload(path, service_name)
            
            return EndpointInfo(
                path=path,
                method=method,
                description=description,
                sample_payload=sample_payload
            )
            
        except Exception as e:
            self.logger.error(f"Error parsing endpoint string '{endpoint_str}': {e}")
            return None
    
    def _generate_endpoint_description(self, method: str, path: str, service_name: str) -> str:
        """
        Generate human-readable description for an endpoint.
        
        Args:
            method: HTTP method
            path: Endpoint path
            service_name: Service name for context
            
        Returns:
            Human-readable description
        """
        # Extract resource name from path
        path_parts = [part for part in path.split('/') if part and not part.startswith('{')]
        resource = path_parts[-1] if path_parts else 'resource'
        
        # Generate description based on method
        if method == 'GET':
            if '{' in path:
                return f"Get specific {resource} by ID"
            else:
                return f"Get all {resource}"
        elif method == 'POST':
            return f"Create new {resource}"
        elif method == 'PUT':
            return f"Update {resource}"
        elif method == 'PATCH':
            return f"Partially update {resource}"
        elif method == 'DELETE':
            return f"Delete {resource}"
        else:
            return f"{method} {resource}"
    
    def _generate_sample_payload(self, path: str, service_name: str) -> Optional[Dict[str, Any]]:
        """
        Generate sample payload for POST/PUT requests.
        
        Args:
            path: Endpoint path
            service_name: Service name for context
            
        Returns:
            Sample payload dictionary or None
        """
        service_type = service_name.lower().replace('-', '_')
        
        # Generate payload based on service type and path
        if 'user' in service_type and 'user' in path.lower():
            return {
                "name": "John Doe",
                "email": "john.doe@example.com",
                "age": 30
            }
        elif 'transaction' in service_type and 'transaction' in path.lower():
            return {
                "amount": 100.50,
                "currency": "USD",
                "description": "Sample transaction",
                "userId": 1
            }
        elif 'product' in service_type and 'product' in path.lower():
            return {
                "name": "Sample Product",
                "description": "A sample product for testing",
                "price": 29.99,
                "category": "Electronics"
            }
        else:
            # Generic payload
            return {
                "data": "sample value",
                "timestamp": datetime.now().isoformat()
            }
    
    async def execute_sample_endpoint(
        self, 
        service_name: str, 
        endpoint_info: EndpointInfo
    ) -> ServiceExecutionResult:
        """
        Execute a sample endpoint with appropriate payload.
        
        Args:
            service_name: Name of the target service
            endpoint_info: Endpoint information to execute
            
        Returns:
            ServiceExecutionResult with request outcome
        """
        kwargs = {}
        
        # Add sample payload for methods that support it
        if endpoint_info.method in ['POST', 'PUT', 'PATCH'] and endpoint_info.sample_payload:
            kwargs['json'] = endpoint_info.sample_payload
            kwargs['headers'] = kwargs.get('headers', {})
            kwargs['headers']['Content-Type'] = 'application/json'
        
        return await self.execute_request(
            service_name=service_name,
            endpoint=endpoint_info.path,
            method=endpoint_info.method,
            **kwargs
        )
    
    def get_service_health(self, service_name: str) -> Optional[ServiceHealthInfo]:
        """
        Get current health information for a service.
        
        Args:
            service_name: Name of the service
            
        Returns:
            ServiceHealthInfo if available, None otherwise
        """
        if self._health_checker:
            return self._health_checker.get_service_health(service_name)
        return None
    
    def get_all_health_info(self) -> Dict[str, ServiceHealthInfo]:
        """
        Get health information for all services.
        
        Returns:
            Dictionary mapping service names to health information
        """
        if self._health_checker:
            return self._health_checker.get_all_health_info()
        return {}
    
    def add_health_status_callback(self, callback: Callable[[str, ServiceHealthInfo], None]):
        """
        Add callback for health status changes.
        
        Args:
            callback: Function to call when health status changes
        """
        self._status_callbacks.append(callback)
        if self._health_checker:
            self._health_checker.add_status_callback(callback)
    
    def remove_health_status_callback(self, callback: Callable[[str, ServiceHealthInfo], None]):
        """
        Remove health status change callback.
        
        Args:
            callback: Callback function to remove
        """
        if callback in self._status_callbacks:
            self._status_callbacks.remove(callback)
        if self._health_checker:
            self._health_checker.remove_status_callback(callback)
    
    async def force_health_check(self, service_name: Optional[str] = None):
        """
        Force an immediate health check.
        
        Args:
            service_name: Specific service to check, or None for all services
        """
        if self._health_checker:
            await self._health_checker.force_check(service_name)
    
    def get_configuration_errors(self) -> List[ValidationError]:
        """
        Get configuration validation errors.
        
        Returns:
            List of validation errors
        """
        if self._config_data:
            return self._config_data.validation_errors
        return []
    
    def is_service_available(self, service_name: str) -> bool:
        """
        Check if a service is available and configured.
        
        Args:
            service_name: Name of the service
            
        Returns:
            True if service is available, False otherwise
        """
        return service_name in self._services
    
    def get_gateway_config(self):
        """
        Get gateway configuration.
        
        Returns:
            GatewayConfig if available, None otherwise
        """
        if self._config_data:
            return self._config_data.gateway
        return None
    
    async def reload_configuration(self, env_path: str) -> bool:
        """
        Reload configuration from environment file.
        
        Args:
            env_path: Path to environment configuration file
            
        Returns:
            True if reload successful, False otherwise
        """
        self.logger.info("Reloading service configuration")
        
        # Stop current health monitoring
        if self._health_checker:
            await self._health_checker.stop_monitoring()
        
        # Close existing HTTP clients
        for client in self._http_clients.values():
            await client.close()
        
        # Reinitialize with new configuration
        return await self.initialize(env_path)
    
    async def shutdown(self):
        """
        Shutdown service manager and cleanup resources.
        """
        self.logger.info("Shutting down service manager")
        
        # Stop health monitoring
        if self._health_checker:
            await self._health_checker.stop_monitoring()
        
        # Close HTTP clients
        for client in self._http_clients.values():
            await client.close()
        
        # Clear internal state
        self._services.clear()
        self._http_clients.clear()
        self._sample_endpoints_cache.clear()
        self._status_callbacks.clear()
        
        self.logger.info("Service manager shutdown complete")
    
    def get_sample_endpoints_by_category(self, service_name: str, category: str) -> List[EndpointInfo]:
        """
        Get sample endpoints filtered by category.
        
        Args:
            service_name: Name of the service
            category: Category to filter by
            
        Returns:
            List of EndpointInfo objects in the specified category
        """
        sample_endpoints = self._sample_endpoint_provider.get_endpoints_by_category(service_name, category)
        
        endpoint_infos = []
        for sample_endpoint in sample_endpoints:
            endpoint_info = EndpointInfo(
                path=sample_endpoint.path,
                method=sample_endpoint.method,
                description=sample_endpoint.description,
                sample_payload=sample_endpoint.sample_payload
            )
            endpoint_infos.append(endpoint_info)
        
        return endpoint_infos
    
    def get_sample_endpoint_categories(self, service_name: str) -> List[str]:
        """
        Get all categories for a service's sample endpoints.
        
        Args:
            service_name: Name of the service
            
        Returns:
            List of category names
        """
        return self._sample_endpoint_provider.get_categories_for_service(service_name)
    
    def search_sample_endpoints(self, service_name: str, query: str) -> List[EndpointInfo]:
        """
        Search sample endpoints by query.
        
        Args:
            service_name: Name of the service
            query: Search query
            
        Returns:
            List of matching EndpointInfo objects
        """
        sample_endpoints = self._sample_endpoint_provider.search_endpoints(service_name, query)
        
        endpoint_infos = []
        for sample_endpoint in sample_endpoints:
            endpoint_info = EndpointInfo(
                path=sample_endpoint.path,
                method=sample_endpoint.method,
                description=sample_endpoint.description,
                sample_payload=sample_endpoint.sample_payload
            )
            endpoint_infos.append(endpoint_info)
        
        return endpoint_infos
    
    def get_sample_endpoint_details(self, service_name: str, path: str, method: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific sample endpoint.
        
        Args:
            service_name: Name of the service
            path: Endpoint path
            method: HTTP method
            
        Returns:
            Dictionary with detailed endpoint information or None if not found
        """
        sample_endpoints = self._sample_endpoint_provider.get_endpoints_for_service(service_name)
        
        for endpoint in sample_endpoints:
            if endpoint.path == path and endpoint.method.upper() == method.upper():
                return {
                    'path': endpoint.path,
                    'method': endpoint.method,
                    'description': endpoint.description,
                    'category': endpoint.category,
                    'sample_payload': endpoint.sample_payload,
                    'expected_response': endpoint.expected_response,
                    'parameters': endpoint.parameters,
                    'headers': endpoint.headers,
                    'tags': endpoint.tags
                }
        
        return None