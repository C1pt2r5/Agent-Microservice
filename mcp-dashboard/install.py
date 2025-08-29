#!/usr/bin/env python3
"""
Installation script for MCP Dashboard GUI.

This script provides an easy way to install and set up the MCP Dashboard GUI
with all dependencies and configuration.
"""

import sys
import os
import subprocess
import shutil
from pathlib import Path


def print_header():
    """Print installation header."""
    print("=" * 60)
    print("MCP Dashboard GUI - Installation Script")
    print("=" * 60)
    print()


def check_python_version():
    """Check if Python version meets requirements."""
    print("Checking Python version...")
    
    min_version = (3, 8)
    current_version = sys.version_info[:2]
    
    if current_version >= min_version:
        print(f"✓ Python {'.'.join(map(str, current_version))} meets requirements")
        return True
    else:
        print(f"✗ Python {'.'.join(map(str, current_version))} is below minimum required {'.'.join(map(str, min_version))}")
        print("Please upgrade Python to version 3.8 or higher")
        return False


def check_pip():
    """Check if pip is available."""
    print("Checking pip availability...")
    
    try:
        subprocess.run([sys.executable, "-m", "pip", "--version"], 
                      check=True, capture_output=True)
        print("✓ pip is available")
        return True
    except subprocess.CalledProcessError:
        print("✗ pip is not available")
        print("Please install pip to continue")
        return False


def install_dependencies():
    """Install Python dependencies."""
    print("Installing dependencies...")
    
    try:
        # Install from requirements.txt
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
        ], check=True)
        print("✓ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install dependencies: {e}")
        return False


def install_package():
    """Install the package in development mode."""
    print("Installing MCP Dashboard GUI package...")
    
    try:
        # Install in development mode
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-e", "."
        ], check=True)
        print("✓ Package installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install package: {e}")
        return False


def run_validation():
    """Run startup validation."""
    print("Running startup validation...")
    
    try:
        result = subprocess.run([
            sys.executable, "app.py", "--validate-only"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✓ Startup validation passed")
            return True
        else:
            print("✗ Startup validation failed")
            print("Validation output:")
            print(result.stdout)
            if result.stderr:
                print("Errors:")
                print(result.stderr)
            return False
    except Exception as e:
        print(f"✗ Failed to run validation: {e}")
        return False


def create_desktop_shortcut():
    """Create desktop shortcut (Windows only)."""
    if sys.platform != "win32":
        return True
    
    print("Creating desktop shortcut...")
    
    try:
        import winshell
        from win32com.client import Dispatch
        
        desktop = winshell.desktop()
        path = os.path.join(desktop, "MCP Dashboard GUI.lnk")
        target = sys.executable
        wDir = str(Path(__file__).parent)
        arguments = f'"{Path(__file__).parent / "app.py"}"'
        
        shell = Dispatch('WScript.Shell')
        shortcut = shell.CreateShortCut(path)
        shortcut.Targetpath = target
        shortcut.Arguments = arguments
        shortcut.WorkingDirectory = wDir
        shortcut.save()
        
        print("✓ Desktop shortcut created")
        return True
    except ImportError:
        print("⚠ Could not create desktop shortcut (winshell not available)")
        return True
    except Exception as e:
        print(f"⚠ Could not create desktop shortcut: {e}")
        return True


def print_usage_instructions():
    """Print usage instructions."""
    print()
    print("=" * 60)
    print("Installation Complete!")
    print("=" * 60)
    print()
    print("You can now run MCP Dashboard GUI in several ways:")
    print()
    print("1. Direct execution:")
    print("   python app.py")
    print()
    print("2. Using installed command (if package was installed):")
    print("   mcp-dashboard")
    print("   mcp-dashboard-gui")
    print()
    print("3. With options:")
    print("   python app.py --help          # Show all options")
    print("   python app.py --debug         # Enable debug logging")
    print("   python app.py --validate-only # Run validation only")
    print()
    print("Configuration:")
    print("- Place your configuration in: ../.env.mcp-gateway.example")
    print("- Or set MCP_CONFIG_PATH environment variable")
    print()
    print("For more information, see README.md")
    print()


def main():
    """Main installation function."""
    print_header()
    
    # Check prerequisites
    if not check_python_version():
        return 1
    
    if not check_pip():
        return 1
    
    # Install dependencies
    if not install_dependencies():
        print("Failed to install dependencies. Please check the error messages above.")
        return 1
    
    # Install package (optional)
    install_package_success = install_package()
    if not install_package_success:
        print("⚠ Package installation failed, but you can still run with 'python app.py'")
    
    # Run validation
    if not run_validation():
        print("⚠ Validation failed, but installation completed. Check configuration.")
    
    # Create desktop shortcut (Windows only)
    create_desktop_shortcut()
    
    # Print usage instructions
    print_usage_instructions()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())