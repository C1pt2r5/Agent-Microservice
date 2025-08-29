"""
Input validation utilities for MCP Dashboard application.
Provides validation functions for URLs, JSON, and other user inputs.
"""
import re
import json
import urllib.parse
from typing import Optional, Dict, Any, List, Tuple, Union
from dataclasses import dataclass
from enum import Enum


class ValidationResult:
    """Result of a validation operation."""
    
    def __init__(self, is_valid: bool, message: Optional[str] = None, suggestions: Optional[List[str]] = None):
        """
        Initialize validation result.
        
        Args:
            is_valid: Whether the validation passed
            message: Error message if validation failed
            suggestions: Suggested corrections
        """
        self.is_valid = is_valid
        self.message = message or ""
        self.suggestions = suggestions or []
    
    def __bool__(self):
        """Allow using ValidationResult in boolean context."""
        return self.is_valid
    
    def __str__(self):
        """String representation of validation result."""
        if self.is_valid:
            return "Valid"
        return f"Invalid: {self.message}"


class URLValidator:
    """Validator for URLs and endpoints."""
    
    @staticmethod
    def validate_url(url: str, require_scheme: bool = True) -> ValidationResult:
        """
        Validate a URL.
        
        Args:
            url: URL to validate
            require_scheme: Whether to require http/https scheme
            
        Returns:
            ValidationResult with validation outcome
        """
        if not url or not url.strip():
            return ValidationResult(False, "URL cannot be empty")
        
        url = url.strip()
        
        try:
            parsed = urllib.parse.urlparse(url)
            
            # Check scheme
            if require_scheme:
                if not parsed.scheme:
                    return ValidationResult(
                        False, 
                        "URL must include a scheme (http:// or https://)",
                        ["Add http:// or https:// to the beginning"]
                    )
                
                if parsed.scheme not in ['http', 'https']:
                    return ValidationResult(
                        False,
                        "URL scheme must be http or https",
                        ["Use http:// or https://"]
                    )
            
            # Check netloc (domain/host)
            if not parsed.netloc:
                return ValidationResult(
                    False,
                    "URL must include a host/domain",
                    ["Add a valid domain name (e.g., localhost, example.com)"]
                )
            
            # Check for valid characters
            if any(char in url for char in [' ', '\t', '\n', '\r']):
                return ValidationResult(
                    False,
                    "URL cannot contain whitespace characters",
                    ["Remove spaces and line breaks from the URL"]
                )
            
            return ValidationResult(True)
            
        except Exception as e:
            return ValidationResult(
                False,
                f"Invalid URL format: {str(e)}",
                ["Check the URL format and try again"]
            )
    
    @staticmethod
    def validate_endpoint_path(path: str) -> ValidationResult:
        """
        Validate an API endpoint path.
        
        Args:
            path: Endpoint path to validate
            
        Returns:
            ValidationResult with validation outcome
        """
        if not path:
            return ValidationResult(False, "Endpoint path cannot be empty")
        
        path = path.strip()
        
        # Check if path starts with /
        if not path.startswith('/'):
            return ValidationResult(
                False,
                "Endpoint path should start with /",
                [f"Use '/{path}' instead"]
            )
        
        # Check for invalid characters
        invalid_chars = [' ', '\t', '\n', '\r', '#', '?']
        for char in invalid_chars:
            if char in path:
                return ValidationResult(
                    False,
                    f"Endpoint path cannot contain '{char}' character",
                    ["Remove invalid characters from the path"]
                )
        
        # Check for double slashes
        if '//' in path:
            return ValidationResult(
                False,
                "Endpoint path cannot contain double slashes",
                ["Remove extra slashes from the path"]
            )
        
        return ValidationResult(True)
    
    @staticmethod
    def normalize_url(url: str) -> str:
        """
        Normalize a URL by adding scheme if missing and cleaning up.
        
        Args:
            url: URL to normalize
            
        Returns:
            Normalized URL
        """
        if not url:
            return url
        
        url = url.strip()
        
        # Add scheme if missing
        if not url.startswith(('http://', 'https://')):
            # Default to http for localhost, https for others
            if url.startswith('localhost') or url.startswith('127.0.0.1'):
                url = f"http://{url}"
            else:
                url = f"https://{url}"
        
        # Remove trailing slash
        if url.endswith('/') and len(url) > 1:
            url = url.rstrip('/')
        
        return url


class JSONValidator:
    """Validator for JSON data."""
    
    @staticmethod
    def validate_json(json_str: str) -> ValidationResult:
        """
        Validate JSON string.
        
        Args:
            json_str: JSON string to validate
            
        Returns:
            ValidationResult with validation outcome
        """
        if not json_str or not json_str.strip():
            return ValidationResult(True)  # Empty JSON is valid (will be ignored)
        
        json_str = json_str.strip()
        
        try:
            json.loads(json_str)
            return ValidationResult(True)
            
        except json.JSONDecodeError as e:
            # Try to provide helpful error messages
            error_msg = str(e)
            suggestions = []
            
            if "Expecting ',' delimiter" in error_msg:
                suggestions.append("Check for missing commas between object properties")
            elif "Expecting ':' delimiter" in error_msg:
                suggestions.append("Check for missing colons after property names")
            elif "Expecting property name" in error_msg:
                suggestions.append("Property names must be enclosed in double quotes")
            elif "Unterminated string" in error_msg:
                suggestions.append("Check for missing closing quotes")
            elif "Expecting value" in error_msg:
                suggestions.append("Check for trailing commas or missing values")
            else:
                suggestions.append("Check JSON syntax and formatting")
            
            return ValidationResult(
                False,
                f"Invalid JSON: {error_msg}",
                suggestions
            )
        
        except Exception as e:
            return ValidationResult(
                False,
                f"JSON validation error: {str(e)}",
                ["Check JSON format and try again"]
            )
    
    @staticmethod
    def format_json(json_str: str, indent: int = 2) -> str:
        """
        Format JSON string with proper indentation.
        
        Args:
            json_str: JSON string to format
            indent: Number of spaces for indentation
            
        Returns:
            Formatted JSON string
        """
        try:
            if not json_str or not json_str.strip():
                return json_str
            
            parsed = json.loads(json_str)
            return json.dumps(parsed, indent=indent, ensure_ascii=False)
            
        except Exception:
            return json_str  # Return original if formatting fails


class InputValidator:
    """General input validator."""
    
    @staticmethod
    def validate_required_field(value: str, field_name: str) -> ValidationResult:
        """
        Validate that a required field is not empty.
        
        Args:
            value: Field value to validate
            field_name: Name of the field for error messages
            
        Returns:
            ValidationResult with validation outcome
        """
        if not value or not value.strip():
            return ValidationResult(
                False,
                f"{field_name} is required",
                [f"Please enter a value for {field_name}"]
            )
        
        return ValidationResult(True)
    
    @staticmethod
    def validate_http_method(method: str) -> ValidationResult:
        """
        Validate HTTP method.
        
        Args:
            method: HTTP method to validate
            
        Returns:
            ValidationResult with validation outcome
        """
        if not method:
            return ValidationResult(False, "HTTP method is required")
        
        method = method.strip().upper()
        valid_methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
        
        if method not in valid_methods:
            return ValidationResult(
                False,
                f"Invalid HTTP method: {method}",
                [f"Use one of: {', '.join(valid_methods)}"]
            )
        
        return ValidationResult(True)
    
    @staticmethod
    def validate_timeout(timeout_str: str) -> ValidationResult:
        """
        Validate timeout value.
        
        Args:
            timeout_str: Timeout value as string
            
        Returns:
            ValidationResult with validation outcome
        """
        if not timeout_str or not timeout_str.strip():
            return ValidationResult(False, "Timeout value is required")
        
        try:
            timeout = int(timeout_str.strip())
            
            if timeout <= 0:
                return ValidationResult(
                    False,
                    "Timeout must be greater than 0",
                    ["Enter a positive number"]
                )
            
            if timeout > 300000:  # 5 minutes
                return ValidationResult(
                    False,
                    "Timeout cannot exceed 300000ms (5 minutes)",
                    ["Use a smaller timeout value"]
                )
            
            return ValidationResult(True)
            
        except ValueError:
            return ValidationResult(
                False,
                "Timeout must be a valid number",
                ["Enter a number in milliseconds (e.g., 5000 for 5 seconds)"]
            )
    
    @staticmethod
    def validate_port(port_str: str) -> ValidationResult:
        """
        Validate port number.
        
        Args:
            port_str: Port number as string
            
        Returns:
            ValidationResult with validation outcome
        """
        if not port_str or not port_str.strip():
            return ValidationResult(False, "Port number is required")
        
        try:
            port = int(port_str.strip())
            
            if port < 1 or port > 65535:
                return ValidationResult(
                    False,
                    "Port must be between 1 and 65535",
                    ["Use a valid port number (e.g., 8080, 3000, 443)"]
                )
            
            return ValidationResult(True)
            
        except ValueError:
            return ValidationResult(
                False,
                "Port must be a valid number",
                ["Enter a number between 1 and 65535"]
            )


class ConfigValidator:
    """Validator for configuration values."""
    
    @staticmethod
    def validate_service_config(config: Dict[str, Any]) -> ValidationResult:
        """
        Validate service configuration.
        
        Args:
            config: Service configuration dictionary
            
        Returns:
            ValidationResult with validation outcome
        """
        required_fields = ['name', 'endpoint']
        missing_fields = []
        
        for field in required_fields:
            if field not in config or not config[field]:
                missing_fields.append(field)
        
        if missing_fields:
            return ValidationResult(
                False,
                f"Missing required fields: {', '.join(missing_fields)}",
                [f"Add {field} to the configuration" for field in missing_fields]
            )
        
        # Validate endpoint URL
        endpoint_result = URLValidator.validate_url(config['endpoint'])
        if not endpoint_result:
            return ValidationResult(
                False,
                f"Invalid endpoint URL: {endpoint_result.message}",
                endpoint_result.suggestions
            )
        
        # Validate timeout if present
        if 'timeout' in config:
            timeout_result = InputValidator.validate_timeout(str(config['timeout']))
            if not timeout_result:
                return ValidationResult(
                    False,
                    f"Invalid timeout: {timeout_result.message}",
                    timeout_result.suggestions
                )
        
        return ValidationResult(True)


def validate_all(*validators: ValidationResult) -> ValidationResult:
    """
    Combine multiple validation results.
    
    Args:
        *validators: ValidationResult objects to combine
        
    Returns:
        Combined ValidationResult (fails if any validator fails)
    """
    failed_validators = [v for v in validators if not v.is_valid]
    
    if not failed_validators:
        return ValidationResult(True)
    
    # Combine error messages
    messages = [v.message for v in failed_validators if v.message]
    combined_message = "; ".join(messages)
    
    # Combine suggestions
    all_suggestions = []
    for v in failed_validators:
        all_suggestions.extend(v.suggestions)
    
    return ValidationResult(False, combined_message, all_suggestions)


# Convenience functions for backward compatibility and simpler testing
def validate_url(url: str) -> bool:
    """Simple URL validation function."""
    if not url:
        return False
    result = URLValidator.validate_url(url)
    return result.is_valid


def validate_port(port: Union[str, int]) -> bool:
    """Simple port validation function."""
    if port is None:
        return False
    result = InputValidator.validate_port(str(port))
    return result.is_valid


def validate_timeout(timeout: Union[str, int]) -> bool:
    """Simple timeout validation function."""
    if timeout is None:
        return False
    result = InputValidator.validate_timeout(str(timeout))
    return result.is_valid


def validate_json(json_str: str) -> bool:
    """Simple JSON validation function."""
    if json_str is None:
        return False
    result = JSONValidator.validate_json(json_str)
    return result.is_valid