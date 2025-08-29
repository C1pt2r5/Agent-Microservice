# MCP Dashboard GUI

A desktop application for testing and monitoring MCP Gateway microservices. This GUI provides a user-friendly interface for interacting with User Service, Transaction Service, and Product Service through the MCP Gateway.

## Features

- **Real-time Service Monitoring**: Monitor health status of all configured microservices
- **Interactive API Testing**: Test endpoints with custom requests and view formatted responses
- **Sample Endpoint Library**: Quick access to pre-configured API calls for common operations
- **Error Handling & Retry Logic**: Robust error handling with configurable retry mechanisms
- **Dynamic Service Discovery**: Automatically discover services from configuration files
- **Cross-platform Support**: Works on Windows, macOS, and Linux

## Requirements

- Python 3.8 or higher
- Tkinter (usually included with Python)
- MCP Gateway running on localhost:8080 (or configured endpoint)

## Installation

### Option 1: Quick Start (Recommended)

1. **Clone or download the project**
2. **Navigate to the mcp-dashboard directory**
3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application:**

   ```bash
   python app.py
   ```

### Option 2: Package Installation

1. **Install as a Python package:**

   ```bash
   pip install -e .
   ```

2. **Run from anywhere:**

   ```bash
   mcp-dashboard
   # or
   mcp-dashboard-gui
   ```

### Option 3: Development Installation

1. **Install with development dependencies:**

   ```bash
   pip install -e .[dev]
   ```

2. **Run tests:**

   ```bash
   pytest
   ```

## Configuration

The application looks for configuration in the following order:

1. `../.env.mcp-gateway.example` (parent directory)
2. `.env.mcp-gateway.example` (current directory)
3. Environment variables
4. Default settings

### Configuration File Format

Create a `.env.mcp-gateway.example` file with your service configurations:

```bash
# MCP Gateway Configuration
MCP_GATEWAY_URL=http://localhost:8080
MCP_GATEWAY_TIMEOUT=30

# Service Definitions
MCP_SERVICES=user-service,transaction-service,product-service

# User Service Configuration
USER_SERVICE_ENDPOINT=/api/users
USER_SERVICE_AUTH_TYPE=none
USER_SERVICE_TIMEOUT=10
USER_SERVICE_RETRY_MAX_ATTEMPTS=3

# Transaction Service Configuration
TRANSACTION_SERVICE_ENDPOINT=/api/transactions
TRANSACTION_SERVICE_AUTH_TYPE=none
TRANSACTION_SERVICE_TIMEOUT=15

# Product Service Configuration
PRODUCT_SERVICE_ENDPOINT=/api/products
PRODUCT_SERVICE_AUTH_TYPE=none
PRODUCT_SERVICE_TIMEOUT=10
```

## Usage

### Starting the Application

```bash
# From the mcp-dashboard directory
python app.py

# Or if installed as package
mcp-dashboard
```

### Using the Interface

1. **Service Selection**: Choose a service from the sidebar
2. **Endpoint Testing**: Enter API endpoints and click "Send Request"
3. **Sample Endpoints**: Use pre-configured buttons for common operations
4. **Health Monitoring**: View real-time service status indicators
5. **Response Viewing**: See formatted JSON responses and error messages

### Command Line Options

```bash
# Enable debug logging
MCP_DEBUG=true python app.py

# Use custom configuration file
MCP_CONFIG_PATH=/path/to/config.env python app.py
```

## Troubleshooting

### Common Issues

**"Required dependencies not installed"**

- Run: `pip install -r requirements.txt`
- Ensure you're using Python 3.8+

**"Configuration file not found"**

- Create `.env.mcp-gateway.example` in the parent directory
- Or set `MCP_CONFIG_PATH` environment variable

**"Service initialization failed"**

- Check if MCP Gateway is running on the configured port
- Verify network connectivity to service endpoints
- Review application logs for detailed error information

**"UI fails to start"**

- Ensure Tkinter is installed (usually comes with Python)
- On Linux: `sudo apt-get install python3-tk`
- Check display settings if using remote/headless systems

### Debug Mode

Enable detailed logging:

```bash
MCP_DEBUG=true python app.py
```

Logs are written to both console and `mcp-dashboard.log` file.

## Development

### Project Structure

```
mcp-dashboard/
├── app.py                    # Main application entry point
├── setup.py                  # Package configuration
├── requirements.txt          # Python dependencies
├── MANIFEST.in              # Package manifest
├── README.md                # This file
├── config/                  # Configuration management
│   ├── __init__.py
│   ├── env_loader.py        # Environment configuration loader
│   ├── service_config.py    # Service configuration classes
│   └── sample_endpoints.py  # Sample endpoint definitions
├── ui/                      # User interface components
│   ├── __init__.py
│   ├── main_window.py       # Main application window
│   ├── service_panel.py     # Service interaction panel
│   └── components/          # Reusable UI components
│       ├── __init__.py
│       ├── json_viewer.py   # JSON response viewer
│       ├── request_form.py  # Request input form
│       └── status_indicator.py # Health status display
├── services/                # Service layer components
│   ├── __init__.py
│   ├── http_client.py       # HTTP client with retry logic
│   ├── health_checker.py    # Service health monitoring
│   └── service_manager.py   # Service coordination
├── utils/                   # Utility functions
│   ├── __init__.py
│   ├── logger.py           # Logging configuration
│   ├── error_handler.py    # Error handling utilities
│   └── validators.py       # Input validation
└── tests/                  # Test suite
    ├── __init__.py
    ├── test_config.py      # Configuration tests
    ├── test_services.py    # Service layer tests
    └── test_ui_components.py # UI component tests
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_config.py
```

### Code Quality

```bash
# Format code
black .

# Lint code
flake8 .

# Type checking
mypy .
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review application logs (`mcp-dashboard.log`)
3. Open an issue on the project repository
4. Include configuration details and error messages
