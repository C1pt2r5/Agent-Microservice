#!/usr/bin/env python3
"""
Test script for MCP Dashboard GUI deployment and packaging.

This script tests various aspects of the application deployment:
- Package structure validation
- Entry point functionality
- Dependency checking
- Configuration loading
- Error handling
"""

import sys
import os
import subprocess
import tempfile
import shutil
from pathlib import Path
import importlib.util


def test_package_structure():
    """Test that the package structure is correct."""
    print("Testing package structure...")
    
    required_files = [
        "app.py",
        "setup.py",
        "requirements.txt",
        "README.md",
        "MANIFEST.in",
        "__init__.py"
    ]
    
    required_dirs = [
        "config",
        "ui",
        "services",
        "utils",
        "tests"
    ]
    
    missing_files = []
    missing_dirs = []
    
    for file_name in required_files:
        if not Path(file_name).exists():
            missing_files.append(file_name)
    
    for dir_name in required_dirs:
        if not Path(dir_name).is_dir():
            missing_dirs.append(dir_name)
    
    if missing_files or missing_dirs:
        print(f"❌ Package structure incomplete:")
        if missing_files:
            print(f"   Missing files: {', '.join(missing_files)}")
        if missing_dirs:
            print(f"   Missing directories: {', '.join(missing_dirs)}")
        return False
    
    print("✅ Package structure is complete")
    return True


def test_init_files():
    """Test that all __init__.py files are present."""
    print("Testing __init__.py files...")
    
    required_init_files = [
        "__init__.py",
        "config/__init__.py",
        "ui/__init__.py",
        "ui/components/__init__.py",
        "services/__init__.py",
        "utils/__init__.py",
        "tests/__init__.py"
    ]
    
    missing_init_files = []
    
    for init_file in required_init_files:
        if not Path(init_file).exists():
            missing_init_files.append(init_file)
    
    if missing_init_files:
        print(f"❌ Missing __init__.py files: {', '.join(missing_init_files)}")
        return False
    
    print("✅ All __init__.py files are present")
    return True


def test_imports():
    """Test that all modules can be imported."""
    print("Testing module imports...")
    
    modules_to_test = [
        "config.env_loader",
        "config.service_config",
        "services.http_client",
        "services.health_checker",
        "services.service_manager",
        "ui.main_window",
        "ui.service_panel",
        "utils.logger",
        "utils.error_handler",
        "utils.startup_validator"
    ]
    
    failed_imports = []
    
    for module_name in modules_to_test:
        try:
            importlib.import_module(module_name)
        except ImportError as e:
            failed_imports.append((module_name, str(e)))
    
    if failed_imports:
        print("❌ Import failures:")
        for module, error in failed_imports:
            print(f"   {module}: {error}")
        return False
    
    print("✅ All modules import successfully")
    return True


def test_entry_point():
    """Test that the main entry point works."""
    print("Testing entry point...")
    
    try:
        # Import the main module
        spec = importlib.util.spec_from_file_location("app", "app.py")
        app_module = importlib.util.module_from_spec(spec)
        
        # Actually load the module
        spec.loader.exec_module(app_module)
        
        # Check that main function exists
        if not hasattr(app_module, 'main'):
            print("❌ Main function not found in app.py")
            return False
        
        # Check that cli_main function exists
        if not hasattr(app_module, 'cli_main'):
            print("❌ cli_main function not found in app.py")
            return False
        
        print("✅ Entry point functions are available")
        return True
        
    except Exception as e:
        print(f"❌ Entry point test failed: {e}")
        return False


def test_startup_validation():
    """Test the startup validation functionality."""
    print("Testing startup validation...")
    
    try:
        from utils.startup_validator import validate_startup
        
        # Run validation
        success, summary = validate_startup()
        
        # Validation should complete (success or failure is OK for testing)
        if summary and len(summary) > 0:
            print("✅ Startup validation runs successfully")
            print(f"   Validation result: {'Passed' if success else 'Failed with warnings'}")
            return True
        else:
            print("❌ Startup validation returned empty summary")
            return False
            
    except Exception as e:
        print(f"❌ Startup validation test failed: {e}")
        return False


def test_requirements_file():
    """Test that requirements.txt is valid."""
    print("Testing requirements.txt...")
    
    try:
        with open("requirements.txt", "r") as f:
            requirements = f.read().strip()
        
        if not requirements:
            print("❌ requirements.txt is empty")
            return False
        
        # Check for basic required packages
        required_packages = ["requests", "python-dotenv", "aiohttp"]
        missing_packages = []
        
        for package in required_packages:
            if package not in requirements:
                missing_packages.append(package)
        
        if missing_packages:
            print(f"❌ Missing required packages in requirements.txt: {', '.join(missing_packages)}")
            return False
        
        print("✅ requirements.txt contains required packages")
        return True
        
    except Exception as e:
        print(f"❌ Requirements file test failed: {e}")
        return False


def test_setup_py():
    """Test that setup.py is valid."""
    print("Testing setup.py...")
    
    try:
        # Try to load setup.py
        spec = importlib.util.spec_from_file_location("setup", "setup.py")
        setup_module = importlib.util.module_from_spec(spec)
        
        # Check that it can be executed (basic syntax check)
        with open("setup.py", "r") as f:
            setup_content = f.read()
        
        # Check for required setup() call
        if "setup(" not in setup_content:
            print("❌ setup.py does not contain setup() call")
            return False
        
        # Check for entry points
        if "entry_points" not in setup_content:
            print("❌ setup.py does not define entry points")
            return False
        
        print("✅ setup.py appears valid")
        return True
        
    except Exception as e:
        print(f"❌ setup.py test failed: {e}")
        return False


def test_error_handling():
    """Test error handling functionality."""
    print("Testing error handling...")
    
    try:
        from utils.error_handler import get_error_handler, ErrorCategory, ErrorSeverity
        
        # Test that error handler can be created
        error_handler = get_error_handler(None)  # No parent window for testing
        
        if error_handler is None:
            print("❌ Error handler creation failed")
            return False
        
        print("✅ Error handling system is functional")
        return True
        
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
        return False


def run_all_tests():
    """Run all deployment tests."""
    print("MCP Dashboard GUI - Deployment Test Suite")
    print("=" * 50)
    
    tests = [
        ("Package Structure", test_package_structure),
        ("Init Files", test_init_files),
        ("Module Imports", test_imports),
        ("Entry Point", test_entry_point),
        ("Startup Validation", test_startup_validation),
        ("Requirements File", test_requirements_file),
        ("Setup.py", test_setup_py),
        ("Error Handling", test_error_handling),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test '{test_name}' crashed: {e}")
            failed += 1
    
    print(f"\n{'=' * 50}")
    print(f"Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All deployment tests passed!")
        return True
    else:
        print("❌ Some deployment tests failed. Please review the issues above.")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)