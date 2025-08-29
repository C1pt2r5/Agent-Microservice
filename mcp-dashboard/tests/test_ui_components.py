"""
Unit tests for UI components.
Tests status indicator, JSON viewer, and request form behavior.
"""
import pytest
import tkinter as tk
from tkinter import ttk
from unittest.mock import Mock, patch, MagicMock
import json
from datetime import datetime

from ui.components.status_indicator import StatusIndicator
from ui.components.json_viewer import JsonViewer
from ui.components.request_form import RequestForm
from services.health_checker import ServiceHealthInfo, HealthStatus


class TestStatusIndicator:
    """Test cases for StatusIndicator component."""
    
    @pytest.fixture
    def root(self):
        """Create root window for testing."""
        root = tk.Tk()
        root.withdraw()  # Hide window during tests
        yield root
        root.destroy()
    
    @pytest.fixture
    def status_indicator(self, root):
        """Create status indicator instance."""
        return StatusIndicator(
            root,
            service_name="test-service",
            initial_status=HealthStatus.UNKNOWN
        )
    
    def test_status_indicator_creation(self, status_indicator):
        """Test status indicator creation with default values."""
        assert status_indicator.service_name == "test-service"
        assert status_indicator.get_current_status() == HealthStatus.UNKNOWN
        assert status_indicator.show_text is True
        assert status_indicator.show_response_time is True
    
    def test_update_status_simple(self, status_indicator):
        """Test updating status without health info."""
        status_indicator.update_status(HealthStatus.HEALTHY)
        
        assert status_indicator.get_current_status() == HealthStatus.HEALTHY
        assert status_indicator.get_health_info() is None
    
    def test_set_service_name(self, status_indicator):
        """Test setting service name."""
        status_indicator.set_service_name("new-service")
        assert status_indicator.service_name == "new-service"


class TestJsonViewer:
    """Test cases for JsonViewer component."""
    
    @pytest.fixture
    def root(self):
        """Create root window for testing."""
        root = tk.Tk()
        root.withdraw()  # Hide window during tests
        yield root
        root.destroy()
    
    @pytest.fixture
    def json_viewer(self, root):
        """Create JSON viewer instance."""
        return JsonViewer(root, width=40, height=10)
    
    def test_json_viewer_creation(self, json_viewer):
        """Test JSON viewer creation with default values."""
        assert json_viewer.width == 40
        assert json_viewer.height == 10
        assert json_viewer.show_line_numbers is True
        assert json_viewer.enable_copy is True
    
    def test_display_json_dict(self, json_viewer):
        """Test displaying JSON dictionary."""
        test_data = {
            "name": "John Doe",
            "age": 30,
            "active": True,
            "balance": 1234.56,
            "address": None
        }
        
        json_viewer.display_json(test_data)
        
        content = json_viewer.get_content()
        assert "John Doe" in content
        assert "30" in content
        assert "true" in content
        assert "1234.56" in content
        assert "null" in content
        
        assert json_viewer.get_json_data() == test_data
    
    def test_display_error(self, json_viewer):
        """Test displaying error message."""
        error_message = "Request failed"
        error_details = "Connection timeout after 30 seconds"
        
        json_viewer.display_error(error_message, error_details)
        
        content = json_viewer.get_content()
        assert "ERROR" in content
        assert error_message in content
        assert error_details in content
    
    def test_clear_content(self, json_viewer):
        """Test clearing viewer content."""
        json_viewer.display_json({"test": "data"})
        assert json_viewer.get_content() != ""
        
        json_viewer.clear()
        
        content = json_viewer.get_content()
        assert content == "" or content.isspace()
        assert json_viewer.get_json_data() is None


class TestRequestForm:
    """Test cases for RequestForm component."""
    
    @pytest.fixture
    def root(self):
        """Create root window for testing."""
        root = tk.Tk()
        root.withdraw()  # Hide window during tests
        yield root
        root.destroy()
    
    @pytest.fixture
    def request_form(self, root):
        """Create request form instance."""
        callback = Mock()
        return RequestForm(root, on_send_request=callback)
    
    def test_request_form_creation(self, request_form):
        """Test request form creation with default values."""
        assert request_form.default_method == 'GET'
        assert request_form.show_headers is True
        assert request_form.show_body is True
        assert request_form.on_send_request is not None
    
    def test_set_endpoint(self, request_form):
        """Test setting endpoint URL."""
        endpoint = "/api/users"
        request_form.set_endpoint(endpoint)
        
        assert request_form.endpoint_var.get() == endpoint
    
    def test_set_method(self, request_form):
        """Test setting HTTP method."""
        request_form.set_method('POST')
        assert request_form.method_var.get() == 'POST'
        
        # Test invalid method (should not change)
        request_form.set_method('INVALID')
        assert request_form.method_var.get() == 'POST'  # Should remain unchanged
    
    def test_clear_form(self, request_form):
        """Test clearing form fields."""
        # Set some values
        request_form.set_endpoint("/api/test")
        request_form.set_method("POST")
        
        # Clear form
        request_form.clear_form()
        
        # Verify fields are cleared
        assert request_form.endpoint_var.get() == ""
        assert request_form.method_var.get() == request_form.default_method
    
    def test_validate_endpoint_valid(self, request_form):
        """Test endpoint validation with valid URLs."""
        valid_endpoints = [
            "/api/users",
            "/api/users/123",
            "/api/users?page=1",
            "/api/users/123?include=profile"
        ]
        
        for endpoint in valid_endpoints:
            request_form.endpoint_var.set(endpoint)
            assert request_form._validate_endpoint() is True
    
    def test_validate_endpoint_invalid(self, request_form):
        """Test endpoint validation with invalid URLs."""
        invalid_endpoints = [
            "",  # Empty
            "api/users",  # Missing leading slash
            "http://example.com/api",  # Full URL not allowed
        ]
        
        for endpoint in invalid_endpoints:
            request_form.endpoint_var.set(endpoint)
            assert request_form._validate_endpoint() is False
    
    def test_loading_state(self, request_form):
        """Test loading state management."""
        # Initially not loading
        assert request_form._is_loading is False
        
        # Set loading
        request_form._set_loading(True)
        assert request_form._is_loading is True
        
        # Clear loading
        request_form._set_loading(False)
        assert request_form._is_loading is False