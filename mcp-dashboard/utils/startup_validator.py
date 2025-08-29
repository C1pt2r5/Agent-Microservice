#!/usr/bin/env python3
"""
Startup validation utilities for MCP Dashboard GUI.

This module provides comprehensive validation of system requirements,
dependencies, and configuration before the application starts.
"""

import sys
import os
import importlib
import platform
import tkinter as tk
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import logging

from .logger import get_logger


class ValidationResult:
    """Represents the result of a validation check."""
    
    def __init__(self, success: bool, message: str, details: Optional[str] = None, 
                 suggested_actions: Optional[List[str]] = None):
        self.success = success
        self.message = message
        self.details = details or ""
        self.suggested_actions = suggested_actions or []
    
    def __str__(self):
        return f"{'✓' if self.success else '✗'} {self.message}"


class StartupValidator:
    """Validates system requirements and configuration before application startup."""
    
    def __init__(self):
        self.logger = get_logger("StartupValidator")
        self.validation_results: List[ValidationResult] = []
        self.critical_failures: List[ValidationResult] = []
        self.warnings: List[ValidationResult] = []
    
    def validate_python_version(self) -> ValidationResult:
        """Validate Python version meets minimum requirements."""
        min_version = (3, 8)
        current_version = sys.version_info[:2]
        
        if current_version >= min_version:
            return ValidationResult(
                success=True,
                message=f"Python version {'.'.join(map(str, current_version))} meets requirements"
            )
        else:
            return ValidationResult(
                success=False,
                message=f"Python version {'.'.join(map(str, current_version))} is below minimum required {'.'.join(map(str, min_version))}",
                suggested_actions=[
                    f"Upgrade Python to version {'.'.join(map(str, min_version))} or higher",
                    "Check your Python installation",
                    "Consider using pyenv or conda to manage Python versions"
                ]
            )
    
    def validate_required_modules(self) -> ValidationResult:
        """Validate that all required Python modules are available."""
        required_modules = [
            ("tkinter", "GUI framework"),
            ("requests", "HTTP client library"),
            ("dotenv", "Environment configuration"),
            ("aiohttp", "Async HTTP client"),
            ("asyncio", "Async programming support")
        ]
        
        missing_modules = []
        available_modules = []
        
        for module_name, description in required_modules:
            try:
                # Handle special cases
                if module_name == "dotenv":
                    importlib.import_module("dotenv")
                else:
                    importlib.import_module(module_name)
                available_modules.append(f"{module_name} ({description})")
            except ImportError:
                missing_modules.append((module_name, description))
        
        if not missing_modules:
            return ValidationResult(
                success=True,
                message=f"All required modules available: {', '.join([m.split(' ')[0] for m in available_modules])}"
            )
        else:
            missing_names = [name for name, _ in missing_modules]
            return ValidationResult(
                success=False,
                message=f"Missing required modules: {', '.join(missing_names)}",
                details=f"Missing modules: {', '.join([f'{name} ({desc})' for name, desc in missing_modules])}",
                suggested_actions=[
                    "Run: pip install -r requirements.txt",
                    "Check your Python environment and PATH",
                    "Verify pip is working correctly",
                    "Consider using a virtual environment"
                ]
            )
    
    def validate_tkinter_availability(self) -> ValidationResult:
        """Validate that Tkinter is properly installed and can create windows."""
        try:
            # Try to import tkinter
            import tkinter as tk
            
            # Try to create a test root window (but don't show it)
            test_root = tk.Tk()
            test_root.withdraw()  # Hide the window
            test_root.destroy()   # Clean up
            
            return ValidationResult(
                success=True,
                message="Tkinter GUI framework is available and functional"
            )
        except ImportError:
            return ValidationResult(
                success=False,
                message="Tkinter GUI framework is not available",
                details="Tkinter is required for the graphical user interface",
                suggested_actions=[
                    "On Ubuntu/Debian: sudo apt-get install python3-tk",
                    "On CentOS/RHEL: sudo yum install tkinter",
                    "On macOS: Tkinter should be included with Python",
                    "On Windows: Tkinter should be included with Python",
                    "Reinstall Python with GUI support enabled"
                ]
            )
        except Exception as e:
            return ValidationResult(
                success=False,
                message="Tkinter is available but cannot create windows",
                details=f"Error: {str(e)}",
                suggested_actions=[
                    "Check display settings (DISPLAY variable on Linux)",
                    "Ensure X11 forwarding is enabled for remote connections",
                    "Verify GUI environment is available",
                    "Try running on a system with desktop environment"
                ]
            )
    
    def validate_system_resources(self) -> ValidationResult:
        """Validate system has adequate resources."""
        warnings = []
        
        # Check available memory (basic check)
        try:
            import psutil
            memory = psutil.virtual_memory()
            available_mb = memory.available / (1024 * 1024)
            
            if available_mb < 100:  # Less than 100MB available
                warnings.append(f"Low available memory: {available_mb:.0f}MB")
        except ImportError:
            # psutil not available, skip memory check
            pass
        
        # Check disk space for logs and temp files
        try:
            import shutil
            free_space = shutil.disk_usage('.').free / (1024 * 1024)  # MB
            
            if free_space < 50:  # Less than 50MB free
                warnings.append(f"Low disk space: {free_space:.0f}MB available")
        except Exception:
            pass
        
        if warnings:
            return ValidationResult(
                success=True,  # Not critical, just warnings
                message="System resources check completed with warnings",
                details="; ".join(warnings),
                suggested_actions=[
                    "Free up system memory by closing other applications",
                    "Clean up disk space",
                    "Monitor system performance during application use"
                ]
            )
        else:
            return ValidationResult(
                success=True,
                message="System resources appear adequate"
            )
    
    def validate_configuration_files(self) -> ValidationResult:
        """Validate configuration file availability and format."""
        project_root = Path(__file__).parent.parent
        
        # Look for configuration files in order of preference
        config_paths = [
            project_root.parent / ".env.mcp-gateway.example",
            project_root / ".env.mcp-gateway.example",
            project_root.parent / ".env",
            project_root / ".env"
        ]
        
        found_config = None
        for config_path in config_paths:
            if config_path.exists():
                found_config = config_path
                break
        
        if found_config:
            # Try to validate the configuration file format
            try:
                from dotenv import load_dotenv
                load_dotenv(found_config)
                
                return ValidationResult(
                    success=True,
                    message=f"Configuration file found and loaded: {found_config.name}",
                    details=f"Full path: {found_config}"
                )
            except Exception as e:
                return ValidationResult(
                    success=False,
                    message=f"Configuration file found but invalid: {found_config.name}",
                    details=f"Error: {str(e)}",
                    suggested_actions=[
                        "Check configuration file syntax",
                        "Verify file is not corrupted",
                        "Review configuration file format in README",
                        "Create a new configuration file from template"
                    ]
                )
        else:
            return ValidationResult(
                success=True,  # Not critical - app can run with defaults
                message="No configuration file found - will use default settings",
                details=f"Searched paths: {', '.join([str(p) for p in config_paths])}",
                suggested_actions=[
                    "Create .env.mcp-gateway.example in parent directory",
                    "Copy configuration template from documentation",
                    "Set environment variables manually if needed",
                    "Application will use default settings"
                ]
            )
    
    def validate_network_connectivity(self) -> ValidationResult:
        """Basic network connectivity validation."""
        try:
            import socket
            
            # Try to resolve localhost
            socket.gethostbyname('localhost')
            
            # Try to create a socket (basic network stack check)
            test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            test_socket.close()
            
            return ValidationResult(
                success=True,
                message="Basic network connectivity appears functional"
            )
        except Exception as e:
            return ValidationResult(
                success=False,
                message="Network connectivity issues detected",
                details=f"Error: {str(e)}",
                suggested_actions=[
                    "Check network configuration",
                    "Verify localhost resolution",
                    "Check firewall settings",
                    "Ensure network stack is functional"
                ]
            )
    
    def validate_permissions(self) -> ValidationResult:
        """Validate file system permissions for application operation."""
        project_root = Path(__file__).parent.parent
        
        issues = []
        
        # Check if we can write to the application directory (for logs)
        try:
            test_file = project_root / "test_write_permission.tmp"
            test_file.write_text("test")
            test_file.unlink()
        except Exception as e:
            issues.append(f"Cannot write to application directory: {str(e)}")
        
        # Check if we can read configuration files
        config_dir = project_root / "config"
        if config_dir.exists():
            try:
                list(config_dir.iterdir())
            except Exception as e:
                issues.append(f"Cannot read configuration directory: {str(e)}")
        
        if issues:
            return ValidationResult(
                success=False,
                message="File system permission issues detected",
                details="; ".join(issues),
                suggested_actions=[
                    "Check file and directory permissions",
                    "Run application with appropriate user privileges",
                    "Verify application directory is not read-only",
                    "Check disk space and file system health"
                ]
            )
        else:
            return ValidationResult(
                success=True,
                message="File system permissions appear adequate"
            )
    
    def run_all_validations(self) -> Tuple[bool, List[ValidationResult], List[ValidationResult]]:
        """
        Run all startup validations.
        
        Returns:
            Tuple of (success, critical_failures, warnings)
        """
        self.validation_results.clear()
        self.critical_failures.clear()
        self.warnings.clear()
        
        # Define validation checks
        validations = [
            ("Python Version", self.validate_python_version, True),
            ("Required Modules", self.validate_required_modules, True),
            ("Tkinter GUI", self.validate_tkinter_availability, True),
            ("System Resources", self.validate_system_resources, False),
            ("Configuration", self.validate_configuration_files, False),
            ("Network Connectivity", self.validate_network_connectivity, False),
            ("File Permissions", self.validate_permissions, True),
        ]
        
        self.logger.info("Starting application validation checks...")
        
        for check_name, validation_func, is_critical in validations:
            try:
                self.logger.debug(f"Running validation: {check_name}")
                result = validation_func()
                self.validation_results.append(result)
                
                if not result.success:
                    if is_critical:
                        self.critical_failures.append(result)
                        self.logger.error(f"Critical validation failed: {check_name} - {result.message}")
                    else:
                        self.warnings.append(result)
                        self.logger.warning(f"Validation warning: {check_name} - {result.message}")
                else:
                    self.logger.debug(f"Validation passed: {check_name}")
                    
            except Exception as e:
                error_result = ValidationResult(
                    success=False,
                    message=f"Validation check '{check_name}' failed with error",
                    details=str(e),
                    suggested_actions=["Check application logs for details", "Report this issue"]
                )
                self.validation_results.append(error_result)
                
                if is_critical:
                    self.critical_failures.append(error_result)
                    self.logger.error(f"Critical validation error: {check_name} - {str(e)}")
                else:
                    self.warnings.append(error_result)
                    self.logger.warning(f"Validation error: {check_name} - {str(e)}")
        
        success = len(self.critical_failures) == 0
        
        self.logger.info(f"Validation complete: {len(self.validation_results)} checks, "
                        f"{len(self.critical_failures)} critical failures, "
                        f"{len(self.warnings)} warnings")
        
        return success, self.critical_failures, self.warnings
    
    def get_validation_summary(self) -> str:
        """Get a formatted summary of all validation results."""
        if not self.validation_results:
            return "No validations have been run."
        
        lines = ["Startup Validation Summary:", "=" * 30]
        
        for result in self.validation_results:
            lines.append(str(result))
            if result.details:
                lines.append(f"  Details: {result.details}")
            if result.suggested_actions:
                lines.append("  Suggested actions:")
                for action in result.suggested_actions:
                    lines.append(f"    - {action}")
            lines.append("")
        
        return "\n".join(lines)


def validate_startup() -> Tuple[bool, str]:
    """
    Convenience function to run all startup validations.
    
    Returns:
        Tuple of (success, summary_message)
    """
    validator = StartupValidator()
    success, critical_failures, warnings = validator.run_all_validations()
    
    summary = validator.get_validation_summary()
    
    return success, summary


if __name__ == "__main__":
    # Allow running this module directly for testing
    success, summary = validate_startup()
    print(summary)
    sys.exit(0 if success else 1)