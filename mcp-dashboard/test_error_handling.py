#!/usr/bin/env python3
"""
Test script for comprehensive error handling in MCP Dashboard.
Tests various error scenarios to ensure proper error handling and user feedback.
"""

import sys
import os
import tkinter as tk
from pathlib import Path
import asyncio
import logging
from unittest.mock import Mock, patch

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from utils.error_handler import ErrorHandler, ErrorCategory, ErrorSeverity, ErrorInfo
from utils.logger import initialize_logging, LogLevel
from ui.main_window import MainWindow
from services.service_manager import ServiceManager
from config.env_loader import EnvLoader


class ErrorHandlingTester:
    """Test class for error handling scenarios."""
    
    def __init__(self):
        """Initialize the error handling tester."""
        # Initialize logging
        initialize_logging(LogLevel.DEBUG, log_to_console=True, log_to_file=False)
        self.logger = logging.getLogger("ErrorHandlingTester")
        
        # Create test window
        self.root = tk.Tk()
        self.root.withdraw()  # Hide the window initially
        
        # Initialize error handler
        self.error_handler = ErrorHandler(self.root)
        
        self.logger.info("Error handling tester initialized")
    
    def test_network_errors(self):
        """Test network-related error handling."""
        self.logger.info("Testing network errors...")
        
        # Test connection error
        connection_error = ConnectionError("Failed to connect to service at localhost:8080")
        error_info = self.error_handler.handle_error(
            connection_error,
            context={"service_name": "test-service", "endpoint": "/health"},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.NETWORK
        assert "network" in error_info.user_message.lower()
        self.logger.info("✓ Connection error handled correctly")
        
        # Test timeout error
        timeout_error = TimeoutError("Request timed out after 30 seconds")
        error_info = self.error_handler.handle_error(
            timeout_error,
            context={"service_name": "slow-service"},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.TIMEOUT
        assert "timeout" in error_info.user_message.lower()
        self.logger.info("✓ Timeout error handled correctly")
    
    def test_service_errors(self):
        """Test service-related error handling."""
        self.logger.info("Testing service errors...")
        
        # Test service unavailable
        service_error = Exception("Service returned 503 Service Unavailable")
        error_info = self.error_handler.handle_error(
            service_error,
            context={"service_name": "user-service", "status_code": 503},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.SERVICE
        self.logger.info("✓ Service error handled correctly")
        
        # Test authentication error
        auth_error = Exception("401 Unauthorized - Invalid API key")
        error_info = self.error_handler.handle_error(
            auth_error,
            context={"service_name": "secure-service"},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.AUTHENTICATION
        self.logger.info("✓ Authentication error handled correctly")
    
    def test_configuration_errors(self):
        """Test configuration-related error handling."""
        self.logger.info("Testing configuration errors...")
        
        # Test missing config file
        config_error = FileNotFoundError("Configuration file not found: .env.mcp-gateway.example")
        error_info = self.error_handler.handle_error(
            config_error,
            context={"operation": "load_config"},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.CONFIGURATION
        self.logger.info("✓ Configuration error handled correctly")
        
        # Test invalid config format
        format_error = ValueError("Invalid configuration format: missing required field 'MCP_GATEWAY_URL'")
        error_info = self.error_handler.handle_error(
            format_error,
            context={"operation": "parse_config"},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.VALIDATION
        self.logger.info("✓ Configuration format error handled correctly")
    
    def test_ui_errors(self):
        """Test UI-related error handling."""
        self.logger.info("Testing UI errors...")
        
        # Test widget creation error
        ui_error = tk.TclError("invalid command name \".widget\"")
        error_info = self.error_handler.handle_error(
            ui_error,
            context={"operation": "create_widget", "widget_type": "button"},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.UI
        self.logger.info("✓ UI error handled correctly")
    
    def test_validation_errors(self):
        """Test validation error handling."""
        self.logger.info("Testing validation errors...")
        
        # Test input validation error
        validation_error = ValueError("Invalid endpoint path: must start with '/'")
        error_info = self.error_handler.handle_error(
            validation_error,
            context={"operation": "validate_input", "field": "endpoint"},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.VALIDATION
        self.logger.info("✓ Validation error handled correctly")
    
    def test_error_history(self):
        """Test error history functionality."""
        self.logger.info("Testing error history...")
        
        # Generate some test errors
        for i in range(5):
            error = Exception(f"Test error {i}")
            self.error_handler.handle_error(error, show_dialog=False)
        
        # Check history
        history = self.error_handler.get_error_history()
        assert len(history) == 5
        self.logger.info(f"✓ Error history contains {len(history)} entries")
        
        # Test category filtering
        network_history = self.error_handler.get_error_history(ErrorCategory.NETWORK)
        self.logger.info(f"✓ Network error history contains {len(network_history)} entries")
        
        # Clear history
        self.error_handler.clear_error_history()
        history = self.error_handler.get_error_history()
        assert len(history) == 0
        self.logger.info("✓ Error history cleared successfully")
    
    def test_error_callbacks(self):
        """Test error callback functionality."""
        self.logger.info("Testing error callbacks...")
        
        callback_called = False
        callback_error_info = None
        
        def test_callback(error_info):
            nonlocal callback_called, callback_error_info
            callback_called = True
            callback_error_info = error_info
        
        # Register callback
        self.error_handler.register_error_callback(ErrorCategory.NETWORK, test_callback)
        
        # Trigger network error
        network_error = ConnectionError("Test network error")
        self.error_handler.handle_error(network_error, show_dialog=False)
        
        assert callback_called
        assert callback_error_info.category == ErrorCategory.NETWORK
        self.logger.info("✓ Error callback executed successfully")
    
    def test_error_dialog_creation(self):
        """Test error dialog creation without showing."""
        self.logger.info("Testing error dialog creation...")
        
        try:
            # Create error info
            error_info = ErrorInfo(
                category=ErrorCategory.SERVICE,
                severity=ErrorSeverity.ERROR,
                message="Test service error",
                suggested_actions=["Action 1", "Action 2", "Action 3"]
            )
            
            # Test dialog creation (without showing)
            self.error_handler._show_detailed_error_dialog(error_info)
            self.logger.info("✓ Error dialog creation successful")
            
        except Exception as e:
            self.logger.error(f"Error dialog creation failed: {e}")
    
    def test_suggested_actions(self):
        """Test suggested actions generation."""
        self.logger.info("Testing suggested actions...")
        
        # Test network error suggestions
        network_error = ConnectionError("Connection refused")
        error_info = self.error_handler.handle_error(network_error, show_dialog=False)
        
        assert error_info.suggested_actions
        assert any("network" in action.lower() for action in error_info.suggested_actions)
        self.logger.info("✓ Network error suggestions generated")
        
        # Test timeout error suggestions
        timeout_error = TimeoutError("Request timed out")
        error_info = self.error_handler.handle_error(timeout_error, show_dialog=False)
        
        assert error_info.suggested_actions
        assert any("timeout" in action.lower() for action in error_info.suggested_actions)
        self.logger.info("✓ Timeout error suggestions generated")
    
    def run_all_tests(self):
        """Run all error handling tests."""
        self.logger.info("Starting comprehensive error handling tests...")
        
        try:
            self.test_network_errors()
            self.test_service_errors()
            self.test_configuration_errors()
            self.test_ui_errors()
            self.test_validation_errors()
            self.test_error_history()
            self.test_error_callbacks()
            self.test_error_dialog_creation()
            self.test_suggested_actions()
            
            self.logger.info("✅ All error handling tests passed!")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Test failed: {e}", exc_info=True)
            return False
        
        finally:
            # Cleanup
            if self.root:
                self.root.destroy()
    
    def run_interactive_test(self):
        """Run interactive error handling test with dialogs."""
        self.logger.info("Starting interactive error handling test...")
        
        # Show the window for interactive testing
        self.root.deiconify()
        self.root.title("Error Handling Test")
        self.root.geometry("400x300")
        
        # Create test buttons
        frame = tk.Frame(self.root)
        frame.pack(expand=True, fill='both', padx=20, pady=20)
        
        tk.Label(frame, text="Error Handling Test", font=('Arial', 14, 'bold')).pack(pady=10)
        
        def test_network_error():
            error = ConnectionError("Failed to connect to service")
            self.error_handler.handle_error(error, show_dialog=True)
        
        def test_service_error():
            error = Exception("Service returned 500 Internal Server Error")
            self.error_handler.handle_error(error, show_dialog=True)
        
        def test_config_error():
            error = FileNotFoundError("Configuration file not found")
            self.error_handler.handle_error(error, show_dialog=True)
        
        def test_validation_error():
            error = ValueError("Invalid input: endpoint must start with '/'")
            self.error_handler.handle_error(error, show_dialog=True)
        
        tk.Button(frame, text="Test Network Error", command=test_network_error).pack(pady=5)
        tk.Button(frame, text="Test Service Error", command=test_service_error).pack(pady=5)
        tk.Button(frame, text="Test Config Error", command=test_config_error).pack(pady=5)
        tk.Button(frame, text="Test Validation Error", command=test_validation_error).pack(pady=5)
        
        tk.Button(frame, text="Close", command=self.root.destroy).pack(pady=20)
        
        self.root.mainloop()


def main():
    """Main function to run error handling tests."""
    tester = ErrorHandlingTester()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--interactive":
        # Run interactive test
        tester.run_interactive_test()
    else:
        # Run automated tests
        success = tester.run_all_tests()
        return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())