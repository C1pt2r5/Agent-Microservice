#!/bin/bash

# Installation script for MCP Dashboard GUI on Unix/Linux/macOS

set -e  # Exit on any error

echo "============================================================"
echo "MCP Dashboard GUI - Unix/Linux/macOS Installation"
echo "============================================================"
echo

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "Error: Python is not installed or not in PATH"
        echo "Please install Python 3.8 or higher"
        exit 1
    else
        PYTHON_CMD="python"
    fi
else
    PYTHON_CMD="python3"
fi

echo "Using Python command: $PYTHON_CMD"

# Check Python version
PYTHON_VERSION=$($PYTHON_CMD -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "Python version: $PYTHON_VERSION"

# Run the Python installation script
echo "Running Python installation script..."
echo

$PYTHON_CMD install.py

if [ $? -eq 0 ]; then
    echo
    echo "Installation completed successfully!"
    echo
    echo "You can now run the application with:"
    echo "  $PYTHON_CMD app.py"
    echo
    echo "Or if the package was installed:"
    echo "  mcp-dashboard"
    echo
else
    echo
    echo "Installation failed. Please check the error messages above."
    exit 1
fi