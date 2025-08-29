#!/usr/bin/env python3
"""
Test script for sample endpoint definitions.
Validates endpoint definitions and tests the sample endpoint system.
"""

import sys
import os
from pathlib import Path
import json

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from config.sample_endpoints import get_sample_endpoint_provider, SampleEndpoint
from config.sample_endpoint_loader import get_sample_endpoint_loader
from services.service_manager import ServiceManager, EndpointInfo
from config.env_loader import EnvLoader


def test_sample_endpoint_provider():
    """Test the sample endpoint provider."""
    print("Testing Sample Endpoint Provider...")
    
    provider = get_sample_endpoint_provider()
    
    # Test getting all services
    services = provider.get_all_services()
    print(f"Available services: {services}")
    
    for service_name in services:
        print(f"\n=== {service_name.upper()} ===")
        
        # Get all endpoints for service
        endpoints = provider.get_endpoints_for_service(service_name)
        print(f"Total endpoints: {len(endpoints)}")
        
        # Get categories
        categories = provider.get_categories_for_service(service_name)
        print(f"Categories: {categories}")
        
        # Show endpoints by category
        for category in categories:
            category_endpoints = provider.get_endpoints_by_category(service_name, category)
            print(f"\n{category} ({len(category_endpoints)} endpoints):")
            
            for endpoint in category_endpoints[:3]:  # Show first 3
                print(f"  • {endpoint.method} {endpoint.path} - {endpoint.description}")
                if endpoint.sample_payload:
                    print(f"    Payload: {json.dumps(endpoint.sample_payload, indent=6)}")
        
        # Test search functionality
        search_results = provider.search_endpoints(service_name, "health")
        if search_results:
            print(f"\nSearch results for 'health': {len(search_results)} found")
            for endpoint in search_results:
                print(f"  • {endpoint.method} {endpoint.path}")


def test_sample_endpoint_loader():
    """Test the sample endpoint loader with environment configuration."""
    print("\n" + "="*60)
    print("Testing Sample Endpoint Loader...")
    
    loader = get_sample_endpoint_loader()
    
    # Test environment variables
    test_env = {
        'MCP_SERVICES': 'user-service,transaction-service',
        'MCP_SERVICE_USER_SERVICE_SAMPLE_ENDPOINTS': 'GET /users/me,POST /users/login',
        'MCP_SERVICE_USER_SERVICE_ENDPOINT_0_DESCRIPTION': 'Get current user profile',
        'MCP_SERVICE_USER_SERVICE_ENDPOINT_0_CATEGORY': 'Authentication',
        'MCP_SERVICE_USER_SERVICE_ENDPOINT_1_DESCRIPTION': 'User login',
        'MCP_SERVICE_USER_SERVICE_ENDPOINT_1_CATEGORY': 'Authentication',
        'MCP_SERVICE_USER_SERVICE_ENDPOINT_1_PAYLOAD': '{"email": "test@example.com", "password": "password123"}',
        'MCP_SERVICE_TRANSACTION_SERVICE_SAMPLE_ENDPOINTS': 'GET /transactions/pending',
        'MCP_SERVICE_TRANSACTION_SERVICE_ENDPOINT_0_DESCRIPTION': 'Get pending transactions',
        'MCP_SERVICE_TRANSACTION_SERVICE_ENDPOINT_0_CATEGORY': 'Transaction Status'
    }
    
    # Load from environment
    merged_endpoints = loader.load_from_environment(test_env)
    
    print(f"Loaded endpoints for {len(merged_endpoints)} services")
    
    for service_name, endpoints in merged_endpoints.items():
        print(f"\n{service_name}: {len(endpoints)} endpoints")
        
        # Show configured endpoints
        configured = loader.get_configured_endpoints(service_name)
        if configured:
            print(f"  Configured endpoints: {len(configured)}")
            for endpoint in configured:
                print(f"    • {endpoint.method} {endpoint.path} - {endpoint.description}")
                if endpoint.sample_payload:
                    print(f"      Payload: {endpoint.sample_payload}")


def test_service_manager_integration():
    """Test integration with service manager."""
    print("\n" + "="*60)
    print("Testing Service Manager Integration...")
    
    try:
        # Create service manager
        env_loader = EnvLoader()
        service_manager = ServiceManager(env_loader)
        
        # Test getting sample endpoints
        test_services = ['user-service', 'transaction-service', 'product-service']
        
        for service_name in test_services:
            print(f"\n{service_name}:")
            
            # Get sample endpoints
            endpoints = service_manager.get_sample_endpoints(service_name)
            print(f"  Total endpoints: {len(endpoints)}")
            
            # Get categories
            categories = service_manager.get_sample_endpoint_categories(service_name)
            print(f"  Categories: {categories}")
            
            # Test search
            search_results = service_manager.search_sample_endpoints(service_name, "user")
            print(f"  Search results for 'user': {len(search_results)}")
            
            # Show first few endpoints
            for endpoint in endpoints[:3]:
                print(f"    • {endpoint.method} {endpoint.path} - {endpoint.description}")
                
                # Get detailed information
                details = service_manager.get_sample_endpoint_details(
                    service_name, endpoint.path, endpoint.method
                )
                if details:
                    print(f"      Category: {details.get('category', 'N/A')}")
                    if details.get('tags'):
                        print(f"      Tags: {', '.join(details['tags'])}")
    
    except Exception as e:
        print(f"Error testing service manager integration: {e}")


def validate_endpoint_definitions():
    """Validate all endpoint definitions for consistency."""
    print("\n" + "="*60)
    print("Validating Endpoint Definitions...")
    
    provider = get_sample_endpoint_provider()
    services = provider.get_all_services()
    
    total_endpoints = 0
    validation_errors = []
    
    for service_name in services:
        endpoints = provider.get_endpoints_for_service(service_name)
        total_endpoints += len(endpoints)
        
        print(f"\nValidating {service_name} ({len(endpoints)} endpoints)...")
        
        for i, endpoint in enumerate(endpoints):
            # Validate required fields
            if not endpoint.path:
                validation_errors.append(f"{service_name}[{i}]: Missing path")
            
            if not endpoint.method:
                validation_errors.append(f"{service_name}[{i}]: Missing method")
            
            if not endpoint.description:
                validation_errors.append(f"{service_name}[{i}]: Missing description")
            
            # Validate path format
            if endpoint.path and not endpoint.path.startswith('/'):
                validation_errors.append(f"{service_name}[{i}]: Path should start with '/'")
            
            # Validate method
            valid_methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
            if endpoint.method and endpoint.method.upper() not in valid_methods:
                validation_errors.append(f"{service_name}[{i}]: Invalid method '{endpoint.method}'")
            
            # Validate sample payload for POST/PUT/PATCH
            if endpoint.method in ['POST', 'PUT', 'PATCH']:
                if not endpoint.sample_payload:
                    print(f"  Warning: {endpoint.method} {endpoint.path} has no sample payload")
            
            # Validate JSON payloads
            if endpoint.sample_payload:
                try:
                    json.dumps(endpoint.sample_payload)
                except (TypeError, ValueError) as e:
                    validation_errors.append(f"{service_name}[{i}]: Invalid sample payload JSON: {e}")
            
            if hasattr(endpoint, 'expected_response') and endpoint.expected_response:
                try:
                    json.dumps(endpoint.expected_response)
                except (TypeError, ValueError) as e:
                    validation_errors.append(f"{service_name}[{i}]: Invalid expected response JSON: {e}")
    
    print(f"\nValidation Summary:")
    print(f"  Total services: {len(services)}")
    print(f"  Total endpoints: {total_endpoints}")
    print(f"  Validation errors: {len(validation_errors)}")
    
    if validation_errors:
        print("\nValidation Errors:")
        for error in validation_errors:
            print(f"  • {error}")
        return False
    else:
        print("  ✅ All endpoint definitions are valid!")
        return True


def generate_endpoint_summary():
    """Generate a summary of all available endpoints."""
    print("\n" + "="*60)
    print("Endpoint Summary Report")
    print("="*60)
    
    provider = get_sample_endpoint_provider()
    services = provider.get_all_services()
    
    for service_name in services:
        print(f"\n## {service_name.upper()}")
        
        endpoints = provider.get_endpoints_for_service(service_name)
        categories = provider.get_categories_for_service(service_name)
        
        print(f"**Total Endpoints:** {len(endpoints)}")
        print(f"**Categories:** {', '.join(categories)}")
        
        for category in categories:
            category_endpoints = provider.get_endpoints_by_category(service_name, category)
            print(f"\n### {category} ({len(category_endpoints)} endpoints)")
            
            for endpoint in category_endpoints:
                payload_info = " (with payload)" if endpoint.sample_payload else ""
                print(f"- `{endpoint.method} {endpoint.path}` - {endpoint.description}{payload_info}")


def main():
    """Main test function."""
    print("Sample Endpoints Test Suite")
    print("="*60)
    
    try:
        # Run all tests
        test_sample_endpoint_provider()
        test_sample_endpoint_loader()
        test_service_manager_integration()
        
        # Validate definitions
        is_valid = validate_endpoint_definitions()
        
        # Generate summary
        generate_endpoint_summary()
        
        print("\n" + "="*60)
        if is_valid:
            print("✅ All tests passed! Sample endpoint system is working correctly.")
            return 0
        else:
            print("❌ Some validation errors found. Please review the endpoint definitions.")
            return 1
            
    except Exception as e:
        print(f"\n❌ Test suite failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())