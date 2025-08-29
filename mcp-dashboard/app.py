#!/usr/bin/env python3
"""
MCP Dashboard GUI - Main Application Entry Point

A desktop application for testing and monitoring MCP Gateway microservices.
Provides a user-friendly interface for interacting with User Service, 
Transaction Service, and Product Service through the MCP Gateway.
"""

import sys
import os
import tkinter as tk
from tkinter import messagebox
import asyncio
import threading
import logging
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

# Add the project root to Python path for imports
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

try:
    from dotenv import load_dotenv
except ImportError:
    print("Error: Required dependencies not installed.")
    print("Please run: pip install -r requirements.txt")
    sys.exit(1)

# Import application components
from config.env_loader import EnvLoader
from services.service_manager import ServiceManager
from ui.main_window import MainWindow

# Import error handling and logging
from utils.logger import initialize_logging, LogLevel, get_logger
from utils.error_handler import get_error_handler, handle_error, ErrorCategory, ErrorSeverity
from utils.startup_validator import validate_startup


class MCPDashboardApp:
    """Main application class for MCP Dashboard GUI."""
    
    def __init__(self):
        """Initialize the MCP Dashboard application."""
        self.root = None
        self.running = False
        
        # Application components
        self.env_loader = None
        self.service_manager = None
        self.main_window = None
        
        # Configuration
        self.env_path = None
        
        # Async event loop management
        self.event_loop = None
        self.loop_thread = None
        
        # Error handling
        self.error_handler = None
        
        # Set up logging and error handling
        self._setup_logging()
        self._setup_error_handling()
        
    def _setup_logging(self):
        """Set up application logging."""
        try:
            # Initialize centralized logging system
            log_level = LogLevel.INFO
            
            # Check for debug environment variable
            if os.getenv('MCP_DEBUG', '').lower() in ['true', '1', 'yes']:
                log_level = LogLevel.DEBUG
            
            # Initialize logging with file and console output
            initialize_logging(
                log_level=log_level,
                log_to_file=True,
                log_to_console=True
            )
            
            self.logger = get_logger("MCPDashboardApp")
            self.logger.info("Logging system initialized successfully")
            
        except Exception as e:
            # Fallback to basic logging if centralized logging fails
            logging.basicConfig(
                level=logging.INFO,
                format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                handlers=[logging.StreamHandler(sys.stdout)]
            )
            self.logger = logging.getLogger("MCPDashboardApp")
            self.logger.error(f"Failed to initialize centralized logging: {e}")
    
    def _setup_error_handling(self):
        """Set up centralized error handling."""
        try:
            # Error handler will be initialized with parent window later
            self.error_handler = None
            self.logger.info("Error handling system ready")
            
        except Exception as e:
            self.logger.error(f"Failed to setup error handling: {e}")
        
    def load_configuration(self):
        """Load configuration from environment files."""
        try:
            # Look for .env.mcp-gateway.example in parent directory
            self.env_path = project_root.parent / ".env.mcp-gateway.example"
            if self.env_path.exists():
                load_dotenv(self.env_path)
                self.logger.info(f"Loaded configuration from: {self.env_path}")
            else:
                self.logger.warning(f"Configuration file not found at {self.env_path}")
                self.logger.info("The application will use default settings.")
                
                # Show user-friendly warning about missing configuration
                if self.root:
                    messagebox.showwarning(
                        "Configuration Notice",
                        f"Configuration file not found at:\n{self.env_path}\n\n"
                        "The application will use default settings.\n"
                        "Some features may not work as expected."
                    )
            
            return True
            
        except Exception as e:
            # Use centralized error handling
            if self.error_handler:
                from utils.error_handler import ErrorInfo, ErrorCategory, ErrorSeverity
                error_info = ErrorInfo(
                    category=ErrorCategory.CONFIGURATION,
                    severity=ErrorSeverity.ERROR,
                    message=f"Failed to load configuration: {str(e)}",
                    context={"operation": "load_configuration", "env_path": str(self.env_path)},
                    suggested_actions=[
                        "Check if the configuration file exists",
                        "Verify file permissions",
                        "Check file format and syntax",
                        "Try running with default settings"
                    ]
                )
                self.error_handler.handle_error(error_info, show_dialog=bool(self.root))
            else:
                self.logger.error(f"Failed to load configuration: {str(e)}")
                if self.root:
                    messagebox.showerror("Configuration Error", f"Failed to load configuration: {str(e)}")
            return False
    
    def validate_dependencies(self):
        """Validate that all required dependencies are available."""
        missing_deps = []
        
        try:
            import requests
        except ImportError:
            missing_deps.append("requests")
            
        try:
            import dotenv
        except ImportError:
            missing_deps.append("python-dotenv")
            
        try:
            import aiohttp
        except ImportError:
            missing_deps.append("aiohttp")
        
        if missing_deps:
            error_msg = f"Missing required dependencies: {', '.join(missing_deps)}\n"
            error_msg += "Please run: pip install -r requirements.txt"
            
            # Use centralized error handling
            if self.error_handler:
                from utils.error_handler import ErrorInfo, ErrorCategory, ErrorSeverity
                error_info = ErrorInfo(
                    category=ErrorCategory.CONFIGURATION,
                    severity=ErrorSeverity.CRITICAL,
                    message=error_msg,
                    suggested_actions=[
                        "Run: pip install -r requirements.txt",
                        "Check your Python environment",
                        "Verify pip is working correctly"
                    ]
                )
                self.error_handler.handle_error(error_info, show_dialog=bool(self.root))
            else:
                print(f"Error: {error_msg}")
                if self.root:
                    messagebox.showerror("Dependency Error", error_msg)
            return False
            
        return True
    
    async def initialize_services(self):
        """Initialize service manager and load configuration."""
        try:
            # Create environment loader
            self.env_loader = EnvLoader()
            
            # Create service manager
            self.service_manager = ServiceManager(self.env_loader)
            
            # Initialize service manager with configuration
            if self.env_path and self.env_path.exists():
                success = await self.service_manager.initialize(str(self.env_path))
                if not success:
                    error_msg = "Failed to initialize service manager with configuration"
                    self.logger.error(error_msg)
                    
                    if self.error_handler:
                        from utils.error_handler import ErrorInfo, ErrorCategory, ErrorSeverity
                        error_info = ErrorInfo(
                            category=ErrorCategory.SERVICE,
                            severity=ErrorSeverity.ERROR,
                            message=error_msg,
                            context={"env_path": str(self.env_path)},
                            suggested_actions=[
                                "Check configuration file format",
                                "Verify service endpoints are accessible",
                                "Check network connectivity",
                                "Review application logs for details"
                            ]
                        )
                        self.error_handler.handle_error(error_info, show_dialog=False)
                    
                    return False
            else:
                self.logger.warning("No configuration file found, using defaults")
                # Initialize with empty configuration for demo purposes
                success = await self.service_manager.initialize("")
                if not success:
                    error_msg = "Failed to initialize service manager with defaults"
                    self.logger.error(error_msg)
                    
                    if self.error_handler:
                        from utils.error_handler import ErrorInfo, ErrorCategory, ErrorSeverity
                        error_info = ErrorInfo(
                            category=ErrorCategory.CONFIGURATION,
                            severity=ErrorSeverity.CRITICAL,
                            message=error_msg,
                            suggested_actions=[
                                "Check if required dependencies are installed",
                                "Verify Python environment is correct",
                                "Try restarting the application",
                                "Check application logs for details"
                            ]
                        )
                        self.error_handler.handle_error(error_info, show_dialog=False)
                    
                    return False
            
            self.logger.info("Service manager initialized successfully")
            return True
            
        except Exception as e:
            error_msg = f"Error initializing services: {e}"
            self.logger.error(error_msg, exc_info=True)
            
            if self.error_handler:
                from utils.error_handler import ErrorInfo, ErrorCategory, ErrorSeverity
                error_info = ErrorInfo(
                    category=ErrorCategory.SERVICE,
                    severity=ErrorSeverity.CRITICAL,
                    message=error_msg,
                    technical_details=str(e),
                    suggested_actions=[
                        "Check if all required services are running",
                        "Verify network connectivity",
                        "Check configuration file syntax",
                        "Review application logs for details",
                        "Try restarting the application"
                    ]
                )
                self.error_handler.handle_error(error_info, show_dialog=False)
            
            return False
    
    def setup_ui(self):
        """Set up the main user interface."""
        try:
            # Create main window with service manager and event loop
            self.main_window = MainWindow(self.service_manager, self.event_loop)
            self.root = self.main_window.create_window()
            
            # Initialize error handler with parent window
            self.error_handler = get_error_handler(self.root)
            
            # Set up proper window closing handler
            self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
            
            self.logger.info("Main window created successfully")
            return True
            
        except Exception as e:
            # Use centralized error handling
            if self.error_handler:
                self.error_handler.handle_error(
                    e,
                    context={"operation": "setup_ui"},
                    show_dialog=bool(self.root)
                )
            else:
                error_msg = f"Failed to create main window: {str(e)}"
                self.logger.error(error_msg)
                messagebox.showerror("UI Error", error_msg)
            return False
    
    def _start_event_loop(self):
        """Start the asyncio event loop in a background thread."""
        def run_loop():
            self.event_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.event_loop)
            try:
                self.event_loop.run_forever()
            finally:
                self.event_loop.close()
        
        self.loop_thread = threading.Thread(target=run_loop, daemon=True)
        self.loop_thread.start()
        
        # Wait a moment for the loop to start
        import time
        time.sleep(0.1)
    
    def on_closing(self):
        """Handle application closing."""
        self.running = False
        self.logger.info("Application closing requested")
        
        # Cleanup service manager
        if self.service_manager and self.event_loop:
            try:
                future = asyncio.run_coroutine_threadsafe(
                    self.service_manager.shutdown(),
                    self.event_loop
                )
                future.result(timeout=5)  # 5 second timeout for shutdown
            except Exception as e:
                self.logger.error(f"Error during service manager shutdown: {e}")
        
        # Stop the event loop
        if self.event_loop:
            self.event_loop.call_soon_threadsafe(self.event_loop.stop)
        
        if self.root:
            self.root.quit()
            self.root.destroy()
    
    def run(self):
        """Run the main application."""
        try:
            self.logger.info("Starting MCP Dashboard GUI...")
            
            # Run comprehensive startup validation
            self.logger.info("Running startup validation checks...")
            validation_success, validation_summary = validate_startup()
            
            if not validation_success:
                self.logger.error("Startup validation failed")
                self.logger.error(validation_summary)
                
                # Show validation errors to user
                print("Startup Validation Failed:")
                print("=" * 50)
                print(validation_summary)
                print("\nPlease resolve the above issues before running the application.")
                return 1
            else:
                self.logger.info("Startup validation completed successfully")
                # Log any warnings from validation
                if "warning" in validation_summary.lower():
                    self.logger.debug("Validation summary:")
                    self.logger.debug(validation_summary)
            
            # Validate dependencies (legacy check - now covered by startup validation)
            if not self.validate_dependencies():
                self.logger.error("Dependency validation failed")
                return 1
            
            # Load configuration
            if not self.load_configuration():
                self.logger.error("Configuration loading failed")
                return 1
            
            # Start background event loop for async operations
            try:
                self._start_event_loop()
                self.logger.info("Background event loop started")
            except Exception as e:
                error_msg = f"Failed to start event loop: {str(e)}"
                self.logger.error(error_msg)
                messagebox.showerror("Event Loop Error", error_msg)
                return 1
            
            # Initialize services
            try:
                future = asyncio.run_coroutine_threadsafe(
                    self.initialize_services(), 
                    self.event_loop
                )
                
                if not future.result(timeout=30):  # 30 second timeout
                    error_msg = "Service initialization timed out or failed"
                    self.logger.error(error_msg)
                    
                    if self.error_handler:
                        from utils.error_handler import ErrorInfo, ErrorCategory, ErrorSeverity
                        error_info = ErrorInfo(
                            category=ErrorCategory.SERVICE,
                            severity=ErrorSeverity.CRITICAL,
                            message=error_msg,
                            suggested_actions=[
                                "Check if MCP Gateway is running",
                                "Verify network connectivity",
                                "Check service endpoints in configuration",
                                "Try restarting the application"
                            ]
                        )
                        self.error_handler.handle_error(error_info, show_dialog=True)
                    else:
                        messagebox.showerror("Service Error", error_msg)
                    
                    return 1
                
            except asyncio.TimeoutError:
                error_msg = "Service initialization timed out after 30 seconds"
                self.logger.error(error_msg)
                messagebox.showerror("Timeout Error", error_msg)
                return 1
            except Exception as e:
                error_msg = f"Service initialization error: {str(e)}"
                self.logger.error(error_msg, exc_info=True)
                
                if self.error_handler:
                    self.error_handler.handle_error(e, context={"operation": "service_initialization"})
                else:
                    messagebox.showerror("Initialization Error", error_msg)
                return 1
            
            # Set up UI
            try:
                if not self.setup_ui():
                    self.logger.error("UI setup failed")
                    return 1
                
                self.running = True
                
                self.logger.info("MCP Dashboard GUI started successfully")
                self.logger.info("Close the window or press Ctrl+C to exit")
                
                # Start the main event loop
                self.main_window.run()
                
            except KeyboardInterrupt:
                self.logger.info("Shutting down MCP Dashboard GUI...")
                self.on_closing()
            except Exception as e:
                error_msg = f"UI runtime error: {str(e)}"
                self.logger.error(error_msg, exc_info=True)
                
                if self.error_handler:
                    self.error_handler.handle_error(e, context={"operation": "ui_runtime"})
                else:
                    messagebox.showerror("Application Error", error_msg)
                return 1
            
            self.logger.info("MCP Dashboard GUI shut down successfully")
            return 0
            
        except Exception as e:
            # Top-level exception handler
            error_msg = f"Critical application error: {str(e)}"
            self.logger.critical(error_msg, exc_info=True)
            
            try:
                if self.error_handler:
                    from utils.error_handler import ErrorInfo, ErrorCategory, ErrorSeverity
                    error_info = ErrorInfo(
                        category=ErrorCategory.UNKNOWN,
                        severity=ErrorSeverity.CRITICAL,
                        message=error_msg,
                        technical_details=str(e),
                        suggested_actions=[
                            "Restart the application",
                            "Check system resources",
                            "Review application logs",
                            "Contact support if issue persists"
                        ]
                    )
                    self.error_handler.handle_error(error_info, show_dialog=True)
                else:
                    messagebox.showerror("Critical Error", error_msg)
            except:
                # Last resort - print to console
                print(f"CRITICAL ERROR: {error_msg}")
            
            return 1
        
        finally:
            # Ensure cleanup happens
            try:
                self.on_closing()
            except Exception as e:
                self.logger.error(f"Error during cleanup: {e}")


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="MCP Dashboard GUI - A desktop application for testing and monitoring MCP Gateway microservices",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python app.py                    # Start with default settings
  python app.py --debug            # Start with debug logging
  python app.py --config /path/to/config.env  # Use custom config file
  python app.py --validate-only    # Only run startup validation
  python app.py --version          # Show version information

Environment Variables:
  MCP_DEBUG=true                   # Enable debug logging
  MCP_CONFIG_PATH=/path/to/config  # Custom configuration file path
  MCP_GATEWAY_URL=http://localhost:8080  # Override gateway URL
        """
    )
    
    parser.add_argument(
        '--version', 
        action='version', 
        version='MCP Dashboard GUI v1.0.0'
    )
    
    parser.add_argument(
        '--debug', 
        action='store_true',
        help='Enable debug logging'
    )
    
    parser.add_argument(
        '--config', 
        type=str,
        help='Path to configuration file'
    )
    
    parser.add_argument(
        '--validate-only', 
        action='store_true',
        help='Run startup validation only and exit'
    )
    
    parser.add_argument(
        '--no-gui', 
        action='store_true',
        help='Run validation checks without starting the GUI'
    )
    
    return parser.parse_args()


def main():
    """Main entry point for the application."""
    try:
        # Parse command line arguments
        args = parse_arguments()
        
        # Set debug mode from command line
        if args.debug:
            os.environ['MCP_DEBUG'] = 'true'
        
        # Set custom config path if provided
        if args.config:
            os.environ['MCP_CONFIG_PATH'] = args.config
        
        # Handle validation-only mode
        if args.validate_only or args.no_gui:
            from utils.startup_validator import validate_startup
            print("Running MCP Dashboard startup validation...")
            success, summary = validate_startup()
            print(summary)
            return 0 if success else 1
        
        # Normal application startup
        app = MCPDashboardApp()
        return app.run()
        
    except KeyboardInterrupt:
        print("\nApplication interrupted by user")
        return 0
    except Exception as e:
        print(f"Fatal error: {e}")
        return 1


def cli_main():
    """CLI entry point for package installation."""
    sys.exit(main())


if __name__ == "__main__":
    sys.exit(main())