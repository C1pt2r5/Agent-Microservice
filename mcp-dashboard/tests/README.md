# MCP Dashboard GUI - Test Suite

This directory contains a comprehensive test suite for the MCP Dashboard GUI application. The test suite covers unit tests, integration tests, error handling, and edge cases.

## Test Structure

```
tests/
├── conftest.py                    # Pytest configuration and shared fixtures
├── fixtures/                     # Test fixtures and mock objects
│   ├── mock_gateway.py           # Mock MCP Gateway server
│   └── config_fixtures.py        # Configuration test fixtures
├── integration/                  # Integration tests
│   ├── test_complete_workflows.py # End-to-end workflow tests
│   └── test_error_scenarios.py   # Error handling integration tests
├── test_config.py                # Configuration system tests
├── test_http_client.py           # HTTP client and retry logic tests
├── test_health_checker.py        # Health monitoring tests
├── test_service_manager.py       # Service management tests
├── test_ui_components.py         # UI component tests
├── test_background_tasks.py      # Background task management tests
├── test_utils.py                 # Utility function tests
└── test_sample_endpoints.py      # Sample endpoint system tests
```

## Test Categories

### Unit Tests

- **Configuration Tests** (`test_config.py`): Environment loading, validation, service configuration
- **HTTP Client Tests** (`test_http_client.py`): Request handling, retry logic, circuit breaker
- **Health Checker Tests** (`test_health_checker.py`): Service health monitoring, status updates
- **Service Manager Tests** (`test_service_manager.py`): Service discovery, request coordination
- **UI Component Tests** (`test_ui_components.py`): Status indicators, JSON viewer, request forms
- **Background Tasks Tests** (`test_background_tasks.py`): Async task management, periodic tasks
- **Utilities Tests** (`test_utils.py`): Logging, error handling, validation functions
- **Sample Endpoints Tests** (`test_sample_endpoints.py`): Endpoint definitions, search functionality

### Integration Tests

- **Complete Workflows** (`test_complete_workflows.py`): End-to-end request execution, multi-service coordination
- **Error Scenarios** (`test_error_scenarios.py`): Network failures, service unavailability, edge cases

### Mock Infrastructure

- **Mock Gateway** (`fixtures/mock_gateway.py`): Simulates MCP Gateway behavior for consistent testing
- **Configuration Fixtures** (`fixtures/config_fixtures.py`): Various configuration scenarios

## Running Tests

### Using the Test Runner

The project includes a comprehensive test runner (`run_tests.py`) that provides various test execution options:

```bash
# Run all tests
python run_tests.py all

# Run specific test categories
python run_tests.py unit          # Unit tests only
python run_tests.py integration   # Integration tests only
python run_tests.py ui            # UI component tests
python run_tests.py config        # Configuration tests
python run_tests.py network       # Network-related tests
python run_tests.py error         # Error handling tests

# Quick smoke tests
python run_tests.py quick

# Performance tests
python run_tests.py performance

# Validate test environment
python run_tests.py validate

# Generate coverage report
python run_tests.py coverage
```

### Using Pytest Directly

```bash
# Run all tests
pytest

# Run specific test files
pytest tests/test_config.py
pytest tests/integration/

# Run with coverage
pytest --cov=. --cov-report=html

# Run with specific markers
pytest -m unit
pytest -m integration
pytest -m "not slow"

# Verbose output
pytest -v

# Run specific test
pytest tests/test_config.py::TestEnvLoader::test_load_valid_config
```

## Test Configuration

### Pytest Configuration (`pytest.ini`)

- Test discovery patterns
- Coverage settings (80% minimum)
- Output formatting
- Marker definitions
- Asyncio configuration

### Shared Fixtures (`conftest.py`)

- Event loop configuration
- Temporary file management
- Mock objects
- Test data fixtures
- Environment variable handling

## Mock Infrastructure

### Mock MCP Gateway

The `MockMCPGateway` class provides a realistic simulation of the MCP Gateway:

- **Endpoints**: User, Transaction, and Product service endpoints
- **Error Simulation**: Configurable failure rates and response delays
- **Request Logging**: Tracks all requests for verification
- **Custom Responses**: Override responses for specific test scenarios
- **Circuit Breaker Simulation**: Simulate circuit breaker states

Example usage:

```python
@pytest.fixture
async def mock_gateway():
    gateway = MockMCPGateway(port=8081)
    await gateway.start()
    
    # Configure custom behavior
    gateway.set_failure_rate("/api/failing", 0.5)  # 50% failure rate
    gateway.set_response_delay("/api/slow", 2.0)   # 2 second delay
    
    yield gateway
    await gateway.stop()
```

### Configuration Fixtures

The `ConfigFixtures` class provides various configuration scenarios:

- Valid configurations (basic and comprehensive)
- Invalid configurations (missing fields, malformed values)
- Edge cases (comments, quoted values, environment variables)

## Test Coverage

The test suite aims for comprehensive coverage:

### Core Components

- ✅ Configuration loading and validation
- ✅ HTTP client with retry logic and circuit breaker
- ✅ Health monitoring system
- ✅ Service management and discovery
- ✅ Background task management
- ✅ Error handling and user feedback
- ✅ Sample endpoint system

### Integration Scenarios

- ✅ Complete request workflows
- ✅ Multi-service coordination
- ✅ Configuration reload during operation
- ✅ Concurrent request handling
- ✅ Error recovery workflows

### Error Handling

- ✅ Network errors (connection refused, timeout)
- ✅ Service errors (4xx, 5xx responses)
- ✅ Configuration errors (missing files, invalid format)
- ✅ Authentication errors
- ✅ Validation errors
- ✅ UI errors
- ✅ Resource exhaustion scenarios

### Edge Cases

- ✅ Malformed responses
- ✅ Large responses
- ✅ Concurrent error scenarios
- ✅ Memory leak prevention
- ✅ Edge case inputs

## Test Data

### Sample Data Fixtures

- User data: ID, name, email, age, status
- Transaction data: ID, amount, currency, user ID, status
- Product data: ID, name, price, category, stock status

### Configuration Scenarios

- Minimal working configuration
- Multi-service configuration
- High-performance configuration
- Resilient configuration
- Invalid configurations

## Continuous Integration

The test suite is designed to work in CI/CD environments:

- **No External Dependencies**: Uses mock services instead of real external services
- **Parallel Execution**: Tests can run in parallel using pytest-xdist
- **Coverage Reporting**: Generates coverage reports in multiple formats
- **Environment Validation**: Checks for required dependencies and setup

## Performance Testing

Performance tests verify:

- Concurrent request handling
- Memory usage patterns
- Resource cleanup
- Response time under load

## Debugging Tests

### Verbose Output

```bash
pytest -v -s  # Verbose with print statements
```

### Specific Test Debugging

```bash
pytest tests/test_config.py::TestEnvLoader::test_load_valid_config -v -s
```

### Coverage Analysis

```bash
pytest --cov=. --cov-report=html
# Open htmlcov/index.html in browser
```

### Test Timing

```bash
pytest --durations=10  # Show 10 slowest tests
```

## Adding New Tests

### Unit Test Template

```python
import pytest
from unittest.mock import Mock, patch

class TestNewComponent:
    """Test cases for new component."""
    
    @pytest.fixture
    def component(self):
        """Create component instance."""
        return NewComponent()
    
    def test_basic_functionality(self, component):
        """Test basic functionality."""
        result = component.do_something()
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_async_functionality(self, component):
        """Test async functionality."""
        result = await component.do_async_something()
        assert result.success is True
```

### Integration Test Template

```python
@pytest.mark.integration
class TestNewIntegration:
    """Integration tests for new feature."""
    
    @pytest.mark.asyncio
    async def test_complete_workflow(self, mock_gateway):
        """Test complete workflow."""
        # Setup
        # Execute
        # Verify
        pass
```

## Best Practices

1. **Use Descriptive Test Names**: Test names should clearly describe what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases
3. **Mock External Dependencies**: Use mocks for external services and file system operations
4. **Test Edge Cases**: Include tests for error conditions and boundary values
5. **Keep Tests Independent**: Each test should be able to run independently
6. **Use Fixtures**: Leverage pytest fixtures for common setup and teardown
7. **Mark Tests Appropriately**: Use pytest markers to categorize tests
8. **Verify Cleanup**: Ensure tests clean up resources and don't leave side effects

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure the project root is in Python path
2. **Async Test Issues**: Use `pytest-asyncio` and proper async fixtures
3. **UI Test Failures**: UI tests require a display; they're skipped in headless environments
4. **Port Conflicts**: Mock gateways use different ports to avoid conflicts
5. **Temporary File Cleanup**: Use fixtures to ensure temporary files are cleaned up

### Environment Issues

1. **Missing Dependencies**: Run `pip install -r requirements.txt`
2. **Python Version**: Requires Python 3.8+
3. **Display for UI Tests**: Set `DISPLAY` environment variable on Linux

### Performance Issues

1. **Slow Tests**: Use `pytest --durations=10` to identify slow tests
2. **Memory Usage**: Monitor memory usage during long test runs
3. **Parallel Execution**: Use `pytest -n auto` for parallel execution

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure good test coverage (aim for >80%)
3. Add appropriate markers and documentation
4. Update this README if adding new test categories
5. Run the full test suite before submitting changes

## Test Metrics

Current test coverage targets:

- **Overall Coverage**: >80%
- **Core Components**: >90%
- **Error Handling**: >95%
- **Configuration**: >90%
- **Network Layer**: >85%
