"""
Sample endpoint configuration loader.
Loads sample endpoint definitions from environment configuration and merges with built-in definitions.
"""
import os
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from .sample_endpoints import SampleEndpoint, get_sample_endpoint_provider


@dataclass
class ConfiguredEndpoint:
    """Endpoint configuration from environment variables."""
    service_name: str
    path: str
    method: str
    description: Optional[str] = None
    category: Optional[str] = None
    sample_payload: Optional[Dict[str, Any]] = None


class SampleEndpointLoader:
    """
    Loader for sample endpoint configurations from environment variables.
    
    Supports loading custom sample endpoints from environment configuration
    and merging them with built-in comprehensive definitions.
    """
    
    def __init__(self):
        """Initialize the sample endpoint loader."""
        self.logger = logging.getLogger("SampleEndpointLoader")
        self._configured_endpoints: Dict[str, List[ConfiguredEndpoint]] = {}
    
    def load_from_environment(self, env_vars: Dict[str, str]) -> Dict[str, List[SampleEndpoint]]:
        """
        Load sample endpoints from environment variables.
        
        Args:
            env_vars: Dictionary of environment variables
            
        Returns:
            Dictionary mapping service names to lists of SampleEndpoint objects
        """
        self._configured_endpoints.clear()
        
        # Parse service-specific endpoint configurations
        services = self._get_services_from_env(env_vars)
        
        for service_name in services:
            endpoints = self._load_service_endpoints(service_name, env_vars)
            if endpoints:
                self._configured_endpoints[service_name] = endpoints
        
        # Convert to SampleEndpoint objects and merge with built-in definitions
        return self._merge_with_builtin_endpoints()
    
    def _get_services_from_env(self, env_vars: Dict[str, str]) -> List[str]:
        """Extract service names from environment variables."""
        services_str = env_vars.get('MCP_SERVICES', '')
        if services_str:
            return [s.strip() for s in services_str.split(',') if s.strip()]
        return []
    
    def _load_service_endpoints(self, service_name: str, env_vars: Dict[str, str]) -> List[ConfiguredEndpoint]:
        """
        Load sample endpoints for a specific service from environment variables.
        
        Environment variable format:
        MCP_SERVICE_{SERVICE_NAME}_SAMPLE_ENDPOINTS=GET /health,POST /users,GET /users/{id}
        MCP_SERVICE_{SERVICE_NAME}_ENDPOINT_{INDEX}_DESCRIPTION=Description for endpoint
        MCP_SERVICE_{SERVICE_NAME}_ENDPOINT_{INDEX}_CATEGORY=Category name
        MCP_SERVICE_{SERVICE_NAME}_ENDPOINT_{INDEX}_PAYLOAD={"key": "value"}
        """
        service_key = service_name.upper().replace('-', '_')
        endpoints_key = f'MCP_SERVICE_{service_key}_SAMPLE_ENDPOINTS'
        
        endpoints_str = env_vars.get(endpoints_key, '')
        if not endpoints_str:
            return []
        
        endpoints = []
        endpoint_specs = [spec.strip() for spec in endpoints_str.split(',') if spec.strip()]
        
        for i, endpoint_spec in enumerate(endpoint_specs):
            try:
                # Parse "METHOD /path" format
                parts = endpoint_spec.split(' ', 1)
                if len(parts) != 2:
                    self.logger.warning(f"Invalid endpoint format: {endpoint_spec}")
                    continue
                
                method, path = parts
                method = method.upper()
                
                # Load additional configuration for this endpoint
                description = env_vars.get(f'MCP_SERVICE_{service_key}_ENDPOINT_{i}_DESCRIPTION')
                category = env_vars.get(f'MCP_SERVICE_{service_key}_ENDPOINT_{i}_CATEGORY')
                payload_str = env_vars.get(f'MCP_SERVICE_{service_key}_ENDPOINT_{i}_PAYLOAD')
                
                sample_payload = None
                if payload_str:
                    try:
                        import json
                        sample_payload = json.loads(payload_str)
                    except json.JSONDecodeError as e:
                        self.logger.warning(f"Invalid JSON payload for {endpoint_spec}: {e}")
                
                endpoint = ConfiguredEndpoint(
                    service_name=service_name,
                    path=path,
                    method=method,
                    description=description,
                    category=category,
                    sample_payload=sample_payload
                )
                endpoints.append(endpoint)
                
            except Exception as e:
                self.logger.error(f"Error parsing endpoint {endpoint_spec}: {e}")
                continue
        
        self.logger.info(f"Loaded {len(endpoints)} configured endpoints for {service_name}")
        return endpoints
    
    def _merge_with_builtin_endpoints(self) -> Dict[str, List[SampleEndpoint]]:
        """
        Merge configured endpoints with built-in comprehensive definitions.
        
        Returns:
            Dictionary mapping service names to merged endpoint lists
        """
        provider = get_sample_endpoint_provider()
        merged_endpoints = {}
        
        # Start with built-in endpoints
        for service_name in provider.get_all_services():
            builtin_endpoints = provider.get_endpoints_for_service(service_name)
            merged_endpoints[service_name] = builtin_endpoints.copy()
        
        # Add configured endpoints
        for service_name, configured_endpoints in self._configured_endpoints.items():
            if service_name not in merged_endpoints:
                merged_endpoints[service_name] = []
            
            for config_endpoint in configured_endpoints:
                # Convert ConfiguredEndpoint to SampleEndpoint
                sample_endpoint = SampleEndpoint(
                    path=config_endpoint.path,
                    method=config_endpoint.method,
                    description=config_endpoint.description or self._generate_description(
                        config_endpoint.method, config_endpoint.path
                    ),
                    category=config_endpoint.category or "Custom",
                    sample_payload=config_endpoint.sample_payload,
                    tags=["configured", "custom"]
                )
                
                # Check if this endpoint already exists (avoid duplicates)
                existing = any(
                    ep.path == sample_endpoint.path and ep.method == sample_endpoint.method
                    for ep in merged_endpoints[service_name]
                )
                
                if not existing:
                    merged_endpoints[service_name].append(sample_endpoint)
                    self.logger.info(f"Added configured endpoint: {service_name} {sample_endpoint.method} {sample_endpoint.path}")
        
        return merged_endpoints
    
    def _generate_description(self, method: str, path: str) -> str:
        """Generate a basic description for an endpoint."""
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
    
    def get_configured_endpoints(self, service_name: str) -> List[ConfiguredEndpoint]:
        """
        Get configured endpoints for a specific service.
        
        Args:
            service_name: Name of the service
            
        Returns:
            List of ConfiguredEndpoint objects
        """
        return self._configured_endpoints.get(service_name, [])
    
    def has_configured_endpoints(self, service_name: str) -> bool:
        """
        Check if a service has configured endpoints.
        
        Args:
            service_name: Name of the service
            
        Returns:
            True if service has configured endpoints, False otherwise
        """
        return service_name in self._configured_endpoints and len(self._configured_endpoints[service_name]) > 0


# Global instance
_sample_endpoint_loader: Optional[SampleEndpointLoader] = None


def get_sample_endpoint_loader() -> SampleEndpointLoader:
    """Get the global sample endpoint loader instance."""
    global _sample_endpoint_loader
    
    if _sample_endpoint_loader is None:
        _sample_endpoint_loader = SampleEndpointLoader()
    
    return _sample_endpoint_loader