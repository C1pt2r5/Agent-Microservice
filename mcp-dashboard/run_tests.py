#!/usr/bin/env python3
"""
Comprehensive test runner for MCP Dashboard GUI.
Provides various test execution options and reporting.
"""

import sys
import os
import subprocess
import argparse
import time
from pathlib import Path
import json


class TestRunner:
    """Test runner for MCP Dashboard GUI."""
    
    def __init__(self):
        """Initialize test runner."""
        self.project_root = Path(__file__).parent
        self.test_dir = self.project_root / "tests"
        
    def run_unit_tests(self, verbose=False, coverage=True):
        """Run unit tests."""
        print("Running Unit Tests...")
        print("=" * 50)
        
        cmd = ["python", "-m", "pytest"]
        
        # Add test paths for unit tests
        unit_test_files = [
            "tests/test_config.py",
            "tests/test_http_client.py", 
            "tests/test_health_checker.py",
            "tests/test_service_manager.py",
            "tests/test_ui_components.py",
            "tests/test_background_tasks.py",
            "tests/test_utils.py",
            "tests/test_sample_endpoints.py"
        ]
        
        cmd.extend(unit_test_files)
        
        # Add options
        if verbose:
            cmd.append("-v")
        else:
            cmd.append("-q")
            
        if coverage:
            cmd.extend(["--cov=.", "--cov-report=term-missing"])
        
        cmd.extend(["-m", "unit"])
        
        return self._run_command(cmd)
    
    def run_integration_tests(self, verbose=False):
        """Run integration tests."""
        print("Running Integration Tests...")
        print("=" * 50)
        
        cmd = ["python", "-m", "pytest"]
        cmd.append("tests/integration/")
        
        if verbose:
            cmd.append("-v")
        else:
            cmd.append("-q")
            
        cmd.extend(["-m", "integration"])
        
        return self._run_command(cmd)
    
    def run_error_handling_tests(self, verbose=False):
        """Run error handling tests."""
        print("Running Error Handling Tests...")
        print("=" * 50)
        
        cmd = ["python", "-m", "pytest"]
        cmd.extend([
            "tests/integration/test_error_scenarios.py",
            "tests/test_utils.py::TestErrorHandler"
        ])
        
        if verbose:
            cmd.append("-v")
        else:
            cmd.append("-q")
            
        cmd.extend(["-m", "error"])
        
        return self._run_command(cmd)
    
    def run_ui_tests(self, verbose=False):
        """Run UI component tests."""
        print("Running UI Tests...")
        print("=" * 50)
        
        cmd = ["python", "-m", "pytest"]
        cmd.append("tests/test_ui_components.py")
        
        if verbose:
            cmd.append("-v")
        else:
            cmd.append("-q")
            
        cmd.extend(["-m", "ui"])
        
        return self._run_command(cmd)
    
    def run_config_tests(self, verbose=False):
        """Run configuration tests."""
        print("Running Configuration Tests...")
        print("=" * 50)
        
        cmd = ["python", "-m", "pytest"]
        cmd.append("tests/test_config.py")
        
        if verbose:
            cmd.append("-v")
        else:
            cmd.append("-q")
            
        cmd.extend(["-m", "config"])
        
        return self._run_command(cmd)
    
    def run_network_tests(self, verbose=False):
        """Run network-related tests."""
        print("Running Network Tests...")
        print("=" * 50)
        
        cmd = ["python", "-m", "pytest"]
        cmd.extend([
            "tests/test_http_client.py",
            "tests/test_health_checker.py",
            "tests/integration/"
        ])
        
        if verbose:
            cmd.append("-v")
        else:
            cmd.append("-q")
            
        cmd.extend(["-m", "network"])
        
        return self._run_command(cmd)
    
    def run_all_tests(self, verbose=False, coverage=True, html_report=False):
        """Run all tests."""
        print("Running All Tests...")
        print("=" * 50)
        
        cmd = ["python", "-m", "pytest"]
        cmd.append("tests/")
        
        if verbose:
            cmd.append("-v")
        else:
            cmd.append("-q")
            
        if coverage:
            cmd.extend(["--cov=.", "--cov-report=term-missing"])
            
            if html_report:
                cmd.append("--cov-report=html:htmlcov")
        
        return self._run_command(cmd)
    
    def run_quick_tests(self):
        """Run quick smoke tests."""
        print("Running Quick Tests...")
        print("=" * 50)
        
        # Run a subset of fast tests
        cmd = ["python", "-m", "pytest"]
        cmd.extend([
            "tests/test_config.py::TestEnvLoader::test_load_valid_config",
            "tests/test_http_client.py::TestHttpClient::test_http_client_init",
            "tests/test_service_manager.py::TestServiceManager::test_get_available_services",
            "tests/test_utils.py::TestValidators::test_validate_url"
        ])
        cmd.extend(["-v", "--tb=short"])
        
        return self._run_command(cmd)
    
    def run_deployment_tests(self):
        """Run deployment-specific tests."""
        print("Running Deployment Tests...")
        print("=" * 50)
        
        # Run the deployment test script
        cmd = ["python", "test_deployment.py"]
        return self._run_command(cmd)
    
    def run_sample_endpoint_tests(self):
        """Run sample endpoint tests."""
        print("Running Sample Endpoint Tests...")
        print("=" * 50)
        
        # Run the sample endpoint test script
        cmd = ["python", "test_sample_endpoints.py"]
        return self._run_command(cmd)
    
    def run_error_handling_interactive(self):
        """Run interactive error handling tests."""
        print("Running Interactive Error Handling Tests...")
        print("=" * 50)
        
        cmd = ["python", "test_error_handling.py", "--interactive"]
        return self._run_command(cmd)
    
    def generate_coverage_report(self):
        """Generate detailed coverage report."""
        print("Generating Coverage Report...")
        print("=" * 50)
        
        # Run tests with coverage
        cmd = ["python", "-m", "pytest", "tests/", "--cov=.", "--cov-report=html:htmlcov", "--cov-report=xml", "-q"]
        result = self._run_command(cmd)
        
        if result == 0:
            print("\nCoverage report generated:")
            print(f"  HTML: {self.project_root}/htmlcov/index.html")
            print(f"  XML:  {self.project_root}/coverage.xml")
        
        return result
    
    def run_performance_tests(self):
        """Run performance-related tests."""
        print("Running Performance Tests...")
        print("=" * 50)
        
        cmd = ["python", "-m", "pytest"]
        cmd.extend([
            "tests/integration/test_complete_workflows.py::TestCompleteWorkflows::test_complete_concurrent_requests_workflow",
            "tests/integration/test_error_scenarios.py::TestErrorScenarios::test_resource_exhaustion_scenarios",
            "tests/integration/test_error_scenarios.py::TestErrorScenarios::test_memory_leak_scenarios"
        ])
        cmd.extend(["-v", "-s", "--tb=short"])
        
        return self._run_command(cmd)
    
    def validate_test_environment(self):
        """Validate test environment setup."""
        print("Validating Test Environment...")
        print("=" * 50)
        
        issues = []
        
        # Check Python version
        if sys.version_info < (3, 8):
            issues.append("Python 3.8+ required")
        else:
            print("✓ Python version OK")
        
        # Check required packages
        required_packages = [
            "pytest", "pytest-asyncio", "aiohttp", "requests", "python-dotenv"
        ]
        
        for package in required_packages:
            try:
                __import__(package.replace("-", "_"))
                print(f"✓ {package} available")
            except ImportError:
                issues.append(f"Missing package: {package}")
        
        # Check test directory structure
        required_dirs = [
            "tests",
            "tests/fixtures", 
            "tests/integration"
        ]
        
        for dir_path in required_dirs:
            full_path = self.project_root / dir_path
            if full_path.exists():
                print(f"✓ {dir_path} directory exists")
            else:
                issues.append(f"Missing directory: {dir_path}")
        
        # Check test files
        test_files = list(self.test_dir.glob("test_*.py"))
        if len(test_files) > 0:
            print(f"✓ Found {len(test_files)} test files")
        else:
            issues.append("No test files found")
        
        if issues:
            print("\n❌ Issues found:")
            for issue in issues:
                print(f"  - {issue}")
            return False
        else:
            print("\n✅ Test environment is ready!")
            return True
    
    def _run_command(self, cmd):
        """Run command and return exit code."""
        try:
            print(f"Running: {' '.join(cmd)}")
            result = subprocess.run(cmd, cwd=self.project_root)
            return result.returncode
        except Exception as e:
            print(f"Error running command: {e}")
            return 1
    
    def print_test_summary(self):
        """Print available test categories."""
        print("MCP Dashboard GUI - Test Suite")
        print("=" * 50)
        print("Available test categories:")
        print("  unit         - Unit tests for individual components")
        print("  integration  - Integration tests for complete workflows")
        print("  ui           - User interface component tests")
        print("  config       - Configuration loading and validation tests")
        print("  network      - Network and HTTP client tests")
        print("  error        - Error handling and edge case tests")
        print("  all          - All tests with coverage report")
        print("  quick        - Fast smoke tests")
        print("  deployment   - Deployment and packaging tests")
        print("  performance  - Performance and load tests")
        print("")
        print("Special commands:")
        print("  validate     - Validate test environment")
        print("  coverage     - Generate detailed coverage report")
        print("  interactive  - Run interactive error handling tests")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="MCP Dashboard GUI Test Runner")
    parser.add_argument(
        "test_type", 
        nargs="?",
        choices=[
            "unit", "integration", "ui", "config", "network", "error", 
            "all", "quick", "deployment", "performance", "validate", 
            "coverage", "interactive"
        ],
        help="Type of tests to run"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--no-coverage", action="store_true", help="Disable coverage reporting")
    parser.add_argument("--html", action="store_true", help="Generate HTML coverage report")
    
    args = parser.parse_args()
    
    runner = TestRunner()
    
    if not args.test_type:
        runner.print_test_summary()
        return 0
    
    start_time = time.time()
    
    # Run the specified test type
    if args.test_type == "unit":
        result = runner.run_unit_tests(args.verbose, not args.no_coverage)
    elif args.test_type == "integration":
        result = runner.run_integration_tests(args.verbose)
    elif args.test_type == "ui":
        result = runner.run_ui_tests(args.verbose)
    elif args.test_type == "config":
        result = runner.run_config_tests(args.verbose)
    elif args.test_type == "network":
        result = runner.run_network_tests(args.verbose)
    elif args.test_type == "error":
        result = runner.run_error_handling_tests(args.verbose)
    elif args.test_type == "all":
        result = runner.run_all_tests(args.verbose, not args.no_coverage, args.html)
    elif args.test_type == "quick":
        result = runner.run_quick_tests()
    elif args.test_type == "deployment":
        result = runner.run_deployment_tests()
    elif args.test_type == "performance":
        result = runner.run_performance_tests()
    elif args.test_type == "validate":
        result = 0 if runner.validate_test_environment() else 1
    elif args.test_type == "coverage":
        result = runner.generate_coverage_report()
    elif args.test_type == "interactive":
        result = runner.run_error_handling_interactive()
    else:
        print(f"Unknown test type: {args.test_type}")
        return 1
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"\nTest execution completed in {duration:.2f} seconds")
    
    if result == 0:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed!")
    
    return result


if __name__ == "__main__":
    sys.exit(main())