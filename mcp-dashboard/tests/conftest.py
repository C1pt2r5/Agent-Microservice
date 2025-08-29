"""
Pytest configuration and shared fixtures.
"""
import pytest
import asyncio
import tempfile
import os
from pathlib import Path
import tkinter as tk
from unittest.mock import Mock, patch

from tests.fixtures.mock_gateway import MockMCPGateway
from tests.fixtures.config_fixtures import ConfigFixtures


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def temp_dir():
    """Create temporary directory for tests."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
def temp_config_file():
    """Create temporary configuration file."""
    config_content = ConfigFixtures.valid_basic_config()
    temp_file = ConfigFixtures.create_temp_env_file(config_content)
    yield temp_file
    ConfigFixtures.cleanup_temp_file(temp_file)


@pytest.fixture
def comprehensive_config_file():
    """Create comprehensive configuration file."""
    config_content = ConfigFixtures.valid_comprehensive_config()
    temp_file = ConfigFixtures.create_temp_env_file(config_content)
    yield temp_file
    ConfigFixtures.cleanup_temp_file(temp_file)


@pytest.fixture
def invalid_config_file():
    """Create invalid configuration file."""
    config_content = ConfigFixtures.invalid_missing_services()
    temp_file = ConfigFixtures.create_temp_env_file(config_content)
    yield temp_file
    ConfigFixtures.cleanup_temp_file(temp_file)


@pytest.fixture
async def mock_gateway():
    """Create and start mock MCP Gateway."""
    gateway = MockMCPGateway(port=8083)  # Use unique port
    await gateway.start()
    yield gateway
    await gateway.stop()


@pytest.fixture
def tk_root():
    """Create Tkinter root window for UI tests."""
    root = tk.Tk()
    root.withdraw()  # Hide window during tests
    yield root
    root.destroy()


@pytest.fixture
def mock_logger():
    """Create mock logger."""
    return Mock()


@pytest.fixture
def sample_service_config():
    """Create sample service configuration."""
    return ConfigFixtures.create_service_config("test-service")


@pytest.fixture
def sample_gateway_config():
    """Create sample gateway configuration."""
    return ConfigFixtures.create_gateway_config()


@pytest.fixture
def sample_configuration_data():
    """Create sample configuration data."""
    return ConfigFixtures.create_configuration_data()


# Pytest markers
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "slow: Slow running tests")
    config.addinivalue_line("markers", "network: Tests that require network access")
    config.addinivalue_line("markers", "ui: Tests that involve UI components")
    config.addinivalue_line("markers", "config: Configuration related tests")
    config.addinivalue_line("markers", "error: Error handling tests")


# Skip UI tests if no display available
def pytest_collection_modifyitems(config, items):
    """Modify test collection to handle UI tests."""
    skip_ui = pytest.mark.skip(reason="No display available for UI tests")
    
    # Check if display is available (for Linux/Unix systems)
    has_display = os.environ.get('DISPLAY') is not None
    
    # On Windows, assume display is available
    if os.name == 'nt':
        has_display = True
    
    for item in items:
        if "ui" in item.keywords and not has_display:
            item.add_marker(skip_ui)


# Async test configuration
@pytest.fixture(scope="session")
def anyio_backend():
    """Configure anyio backend for async tests."""
    return "asyncio"


# Test data fixtures
@pytest.fixture
def sample_user_data():
    """Sample user data for tests."""
    return {
        "id": 1,
        "name": "Test User",
        "email": "test@example.com",
        "age": 30,
        "active": True
    }


@pytest.fixture
def sample_transaction_data():
    """Sample transaction data for tests."""
    return {
        "id": "txn_123",
        "amount": 150.75,
        "currency": "USD",
        "userId": 1,
        "status": "completed",
        "timestamp": 1640995200
    }


@pytest.fixture
def sample_product_data():
    """Sample product data for tests."""
    return {
        "id": 1,
        "name": "Test Product",
        "price": 99.99,
        "category": "Electronics",
        "inStock": True,
        "description": "A test product"
    }


# Environment variable fixtures
@pytest.fixture
def clean_env():
    """Clean environment variables for tests."""
    # Store original environment
    original_env = dict(os.environ)
    
    # Clear MCP-related environment variables
    mcp_vars = [key for key in os.environ.keys() if key.startswith('MCP_')]
    for var in mcp_vars:
        del os.environ[var]
    
    yield
    
    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def mock_env_vars():
    """Mock environment variables for tests."""
    return {
        'MCP_GATEWAY_URL': 'http://localhost:8080',
        'MCP_SERVICES': 'test-service',
        'MCP_SERVICE_TEST_SERVICE_ENDPOINT': 'http://test-service:8080',
        'MCP_SERVICE_TEST_SERVICE_AUTH_TYPE': 'none'
    }


# Network test fixtures
@pytest.fixture
def mock_http_response():
    """Mock HTTP response for tests."""
    response = Mock()
    response.status = 200
    response.json.return_value = {"status": "success"}
    response.text.return_value = '{"status": "success"}'
    response.headers = {"Content-Type": "application/json"}
    return response


@pytest.fixture
def mock_error_response():
    """Mock HTTP error response for tests."""
    response = Mock()
    response.status = 500
    response.json.return_value = {"error": "Internal Server Error"}
    response.text.return_value = '{"error": "Internal Server Error"}'
    response.headers = {"Content-Type": "application/json"}
    return response


# Timeout configuration for async tests
@pytest.fixture(autouse=True)
def configure_async_timeout():
    """Configure timeout for async tests."""
    # Set a reasonable timeout for async tests
    asyncio.get_event_loop().set_debug(True)
    yield
    # Cleanup if needed