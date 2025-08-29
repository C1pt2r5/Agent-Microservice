"""
Unit tests for utility modules.
Tests logger, error handler, startup validator, and other utilities.
"""
import pytest
import tempfile
import os
import logging
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import tkinter as tk

from utils.logger import initialize_logging, LogLevel, get_logger
from utils.error_handler import ErrorHandler, ErrorCategory, ErrorSeverity, ErrorInfo
from utils.startup_validator import validate_startup, ValidationResult
from utils.validators import validate_url, validate_port, validate_timeout, validate_json


class TestLogger:
    """Test cases for logging utilities."""
    
    def test_initialize_logging_console_only(self):
        """Test initializing logging with console output only."""
        initialize_logging(LogLevel.INFO, log_to_console=True, log_to_file=False)
        
        logger = get_logger("test")
        assert logger.level == logging.INFO
    
    def test_initialize_logging_file_only(self):
        """Test initializing logging with file output only."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "test.log"
            
            initialize_logging(
                LogLevel.DEBUG, 
                log_to_console=False, 
                log_to_file=True,
                log_file_path=str(log_file)
            )
            
            logger = get_logger("test")
            logger.info("Test message")
            
            # Verify log file was created and contains message
            assert log_file.exists()
            content = log_file.read_text()
            assert "Test message" in content
    
    def test_initialize_logging_both_outputs(self):
        """Test initializing logging with both console and file output."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "test.log"
            
            initialize_logging(
                LogLevel.WARNING, 
                log_to_console=True, 
                log_to_file=True,
                log_file_path=str(log_file)
            )
            
            logger = get_logger("test")
            logger.warning("Test warning")
            
            # Verify log file was created
            assert log_file.exists()
            content = log_file.read_text()
            assert "Test warning" in content
    
    def test_log_levels(self):
        """Test different log levels."""
        initialize_logging(LogLevel.DEBUG, log_to_console=True, log_to_file=False)
        
        logger = get_logger("test")
        
        # Test that logger accepts all levels
        logger.debug("Debug message")
        logger.info("Info message")
        logger.warning("Warning message")
        logger.error("Error message")
        logger.critical("Critical message")
    
    def test_get_logger_returns_same_instance(self):
        """Test that get_logger returns the same instance for the same name."""
        logger1 = get_logger("test")
        logger2 = get_logger("test")
        
        assert logger1 is logger2


class TestErrorHandler:
    """Test cases for error handler."""
    
    @pytest.fixture
    def root_window(self):
        """Create root window for testing."""
        root = tk.Tk()
        root.withdraw()  # Hide window during tests
        yield root
        root.destroy()
    
    @pytest.fixture
    def error_handler(self, root_window):
        """Create error handler instance."""
        return ErrorHandler(root_window)
    
    def test_error_handler_initialization(self, error_handler):
        """Test error handler initialization."""
        assert error_handler.parent is not None
        assert len(error_handler._error_history) == 0
        assert len(error_handler._callbacks) == 0
    
    def test_handle_network_error(self, error_handler):
        """Test handling network errors."""
        error = ConnectionError("Connection refused")
        
        error_info = error_handler.handle_error(error, show_dialog=False)
        
        assert error_info.category == ErrorCategory.NETWORK
        assert error_info.severity == ErrorSeverity.ERROR
        assert "network" in error_info.user_message.lower()
        assert len(error_info.suggested_actions) > 0
    
    def test_handle_timeout_error(self, error_handler):
        """Test handling timeout errors."""
        error = TimeoutError("Request timed out")
        
        error_info = error_handler.handle_error(error, show_dialog=False)
        
        assert error_info.category == ErrorCategory.TIMEOUT
        assert "timeout" in error_info.user_message.lower()
    
    def test_handle_authentication_error(self, error_handler):
        """Test handling authentication errors."""
        error = Exception("401 Unauthorized")
        
        error_info = error_handler.handle_error(
            error, 
            context={"status_code": 401},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.AUTHENTICATION
        assert "authentication" in error_info.user_message.lower()
    
    def test_handle_service_error(self, error_handler):
        """Test handling service errors."""
        error = Exception("Service returned 500 Internal Server Error")
        
        error_info = error_handler.handle_error(
            error,
            context={"status_code": 500},
            show_dialog=False
        )
        
        assert error_info.category == ErrorCategory.SERVICE
        assert "service" in error_info.user_message.lower()
    
    def test_handle_configuration_error(self, error_handler):
        """Test handling configuration errors."""
        error = FileNotFoundError("Configuration file not found")
        
        error_info = error_handler.handle_error(error, show_dialog=False)
        
        assert error_info.category == ErrorCategory.CONFIGURATION
        assert "configuration" in error_info.user_message.lower()
    
    def test_handle_validation_error(self, error_handler):
        """Test handling validation errors."""
        error = ValueError("Invalid input format")
        
        error_info = error_handler.handle_error(error, show_dialog=False)
        
        assert error_info.category == ErrorCategory.VALIDATION
        assert "validation" in error_info.user_message.lower()
    
    def test_handle_ui_error(self, error_handler):
        """Test handling UI errors."""
        error = tk.TclError("invalid command name")
        
        error_info = error_handler.handle_error(error, show_dialog=False)
        
        assert error_info.category == ErrorCategory.UI
        assert "interface" in error_info.user_message.lower()
    
    def test_error_history(self, error_handler):
        """Test error history functionality."""
        # Generate some errors
        errors = [
            ConnectionError("Network error 1"),
            TimeoutError("Timeout error 1"),
            ValueError("Validation error 1")
        ]
        
        for error in errors:
            error_handler.handle_error(error, show_dialog=False)
        
        # Check history
        history = error_handler.get_error_history()
        assert len(history) == 3
        
        # Check category filtering
        network_history = error_handler.get_error_history(ErrorCategory.NETWORK)
        assert len(network_history) == 1
        assert network_history[0].category == ErrorCategory.NETWORK
        
        # Clear history
        error_handler.clear_error_history()
        assert len(error_handler.get_error_history()) == 0
    
    def test_error_callbacks(self, error_handler):
        """Test error callback functionality."""
        callback_called = False
        callback_error_info = None
        
        def test_callback(error_info):
            nonlocal callback_called, callback_error_info
            callback_called = True
            callback_error_info = error_info
        
        # Register callback
        error_handler.register_error_callback(ErrorCategory.NETWORK, test_callback)
        
        # Trigger network error
        error = ConnectionError("Test network error")
        error_handler.handle_error(error, show_dialog=False)
        
        assert callback_called
        assert callback_error_info.category == ErrorCategory.NETWORK
        
        # Unregister callback
        error_handler.unregister_error_callback(ErrorCategory.NETWORK, test_callback)
        
        # Reset flags
        callback_called = False
        callback_error_info = None
        
        # Trigger another error - callback should not be called
        error_handler.handle_error(ConnectionError("Another error"), show_dialog=False)
        assert not callback_called
    
    def test_suggested_actions_generation(self, error_handler):
        """Test suggested actions generation."""
        test_cases = [
            (ConnectionError("Connection refused"), "network"),
            (TimeoutError("Request timed out"), "timeout"),
            (FileNotFoundError("File not found"), "configuration"),
            (ValueError("Invalid value"), "validation")
        ]
        
        for error, expected_keyword in test_cases:
            error_info = error_handler.handle_error(error, show_dialog=False)
            
            assert len(error_info.suggested_actions) > 0
            # At least one suggestion should contain the expected keyword
            has_keyword = any(expected_keyword in action.lower() for action in error_info.suggested_actions)
            assert has_keyword, f"No suggestion contains '{expected_keyword}' for error: {error}"


class TestStartupValidator:
    """Test cases for startup validator."""
    
    def test_validate_startup_success(self):
        """Test successful startup validation."""
        with patch('utils.startup_validator._check_python_version', return_value=ValidationResult(True, "Python version OK")):
            with patch('utils.startup_validator._check_dependencies', return_value=ValidationResult(True, "Dependencies OK")):
                with patch('utils.startup_validator._check_configuration', return_value=ValidationResult(True, "Configuration OK")):
                    success, summary = validate_startup()
                    
                    assert success is True
                    assert len(summary) > 0
                    assert all("✓" in item or "OK" in item for item in summary)
    
    def test_validate_startup_with_warnings(self):
        """Test startup validation with warnings."""
        with patch('utils.startup_validator._check_python_version', return_value=ValidationResult(True, "Python version OK")):
            with patch('utils.startup_validator._check_dependencies', return_value=ValidationResult(False, "Some dependencies missing")):
                with patch('utils.startup_validator._check_configuration', return_value=ValidationResult(True, "Configuration OK")):
                    success, summary = validate_startup()
                    
                    assert success is False
                    assert len(summary) > 0
                    assert any("missing" in item.lower() for item in summary)
    
    def test_validate_startup_critical_failure(self):
        """Test startup validation with critical failure."""
        with patch('utils.startup_validator._check_python_version', return_value=ValidationResult(False, "Python version too old")):
            success, summary = validate_startup()
            
            assert success is False
            assert len(summary) > 0
            assert any("python" in item.lower() for item in summary)


class TestValidators:
    """Test cases for validation utilities."""
    
    def test_validate_url(self):
        """Test URL validation."""
        valid_urls = [
            "http://localhost:8080",
            "https://example.com",
            "http://192.168.1.1:3000",
            "https://api.example.com/v1"
        ]
        
        invalid_urls = [
            "",
            "not-a-url",
            "ftp://example.com",  # Wrong protocol
            "http://",  # Incomplete
            "localhost:8080"  # Missing protocol
        ]
        
        for url in valid_urls:
            assert validate_url(url) is True, f"URL should be valid: {url}"
        
        for url in invalid_urls:
            assert validate_url(url) is False, f"URL should be invalid: {url}"
    
    def test_validate_port(self):
        """Test port validation."""
        valid_ports = [1, 80, 443, 8080, 65535]
        invalid_ports = [0, -1, 65536, 100000, "not-a-number", None]
        
        for port in valid_ports:
            assert validate_port(port) is True, f"Port should be valid: {port}"
        
        for port in invalid_ports:
            assert validate_port(port) is False, f"Port should be invalid: {port}"
    
    def test_validate_timeout(self):
        """Test timeout validation."""
        valid_timeouts = [1000, 30000, 60000, 1]
        invalid_timeouts = [0, -1000, "not-a-number", None]
        
        for timeout in valid_timeouts:
            assert validate_timeout(timeout) is True, f"Timeout should be valid: {timeout}"
        
        for timeout in invalid_timeouts:
            assert validate_timeout(timeout) is False, f"Timeout should be invalid: {timeout}"
    
    def test_validate_json(self):
        """Test JSON validation."""
        valid_json_strings = [
            '{"key": "value"}',
            '[]',
            '{"nested": {"key": "value"}}',
            '"string"',
            '123',
            'true'
        ]
        
        invalid_json_strings = [
            "",
            "{invalid json}",
            "{'single_quotes': 'not_valid'}",
            "{key: value}",  # Missing quotes
            None
        ]
        
        for json_str in valid_json_strings:
            assert validate_json(json_str) is True, f"JSON should be valid: {json_str}"
        
        for json_str in invalid_json_strings:
            assert validate_json(json_str) is False, f"JSON should be invalid: {json_str}"


class TestErrorInfo:
    """Test cases for ErrorInfo class."""
    
    def test_error_info_creation(self):
        """Test ErrorInfo object creation."""
        error_info = ErrorInfo(
            category=ErrorCategory.NETWORK,
            severity=ErrorSeverity.ERROR,
            message="Test error message",
            user_message="User-friendly message",
            suggested_actions=["Action 1", "Action 2"],
            context={"key": "value"}
        )
        
        assert error_info.category == ErrorCategory.NETWORK
        assert error_info.severity == ErrorSeverity.ERROR
        assert error_info.message == "Test error message"
        assert error_info.user_message == "User-friendly message"
        assert len(error_info.suggested_actions) == 2
        assert error_info.context["key"] == "value"
    
    def test_error_info_string_representation(self):
        """Test ErrorInfo string representation."""
        error_info = ErrorInfo(
            category=ErrorCategory.SERVICE,
            severity=ErrorSeverity.WARNING,
            message="Test message"
        )
        
        str_repr = str(error_info)
        assert "SERVICE" in str_repr
        assert "WARNING" in str_repr
        assert "Test message" in str_repr


class TestValidationResult:
    """Test cases for ValidationResult class."""
    
    def test_validation_result_creation(self):
        """Test ValidationResult object creation."""
        result = ValidationResult(True, "Validation passed")
        
        assert result.success is True
        assert result.message == "Validation passed"
    
    def test_validation_result_failure(self):
        """Test ValidationResult for failure case."""
        result = ValidationResult(False, "Validation failed", details="Additional details")
        
        assert result.success is False
        assert result.message == "Validation failed"
        assert result.details == "Additional details"


if __name__ == '__main__':
    pytest.main([__file__])