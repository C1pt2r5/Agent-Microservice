"""
Logging system for MCP Dashboard application.
Provides structured logging with different levels and output formats.
"""
import logging
import logging.handlers
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum


class LogLevel(Enum):
    """Log levels for the application."""
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR
    CRITICAL = logging.CRITICAL


class MCPDashboardLogger:
    """
    Centralized logging system for MCP Dashboard.
    
    Provides structured logging with file and console output,
    log rotation, and different formatting options.
    """
    
    def __init__(self, 
                 name: str = "MCPDashboard",
                 log_level: LogLevel = LogLevel.INFO,
                 log_to_file: bool = True,
                 log_to_console: bool = True,
                 log_directory: Optional[str] = None):
        """
        Initialize the logging system.
        
        Args:
            name: Logger name
            log_level: Minimum log level to capture
            log_to_file: Whether to log to file
            log_to_console: Whether to log to console
            log_directory: Directory for log files (defaults to logs/)
        """
        self.name = name
        self.log_level = log_level
        self.log_to_file = log_to_file
        self.log_to_console = log_to_console
        
        # Set up log directory
        if log_directory:
            self.log_directory = Path(log_directory)
        else:
            self.log_directory = Path(__file__).parent.parent / "logs"
        
        self.log_directory.mkdir(exist_ok=True)
        
        # Initialize logger
        self.logger = logging.getLogger(name)
        self.logger.setLevel(log_level.value)
        
        # Clear existing handlers to avoid duplicates
        self.logger.handlers.clear()
        
        # Set up handlers
        self._setup_handlers()
        
        # Log startup
        self.logger.info(f"Logging system initialized - Level: {log_level.name}")
    
    def _setup_handlers(self):
        """Set up logging handlers for file and console output."""
        # Console handler
        if self.log_to_console:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(self.log_level.value)
            console_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                datefmt='%H:%M:%S'
            )
            console_handler.setFormatter(console_formatter)
            self.logger.addHandler(console_handler)
        
        # File handler with rotation
        if self.log_to_file:
            log_file = self.log_directory / f"{self.name.lower()}.log"
            
            # Use rotating file handler to prevent huge log files
            file_handler = logging.handlers.RotatingFileHandler(
                log_file,
                maxBytes=10 * 1024 * 1024,  # 10MB
                backupCount=5
            )
            file_handler.setLevel(logging.DEBUG)  # File gets all levels
            
            file_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            file_handler.setFormatter(file_formatter)
            self.logger.addHandler(file_handler)
        
        # Error file handler for errors and above
        if self.log_to_file:
            error_log_file = self.log_directory / f"{self.name.lower()}_errors.log"
            error_handler = logging.handlers.RotatingFileHandler(
                error_log_file,
                maxBytes=5 * 1024 * 1024,  # 5MB
                backupCount=3
            )
            error_handler.setLevel(logging.ERROR)
            
            error_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s\n'
                'Exception: %(exc_info)s\n',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            error_handler.setFormatter(error_formatter)
            self.logger.addHandler(error_handler)
    
    def get_logger(self, name: Optional[str] = None) -> logging.Logger:
        """
        Get a logger instance.
        
        Args:
            name: Optional name for child logger
            
        Returns:
            Logger instance
        """
        if name:
            return logging.getLogger(f"{self.name}.{name}")
        return self.logger
    
    def log_exception(self, 
                     message: str, 
                     exception: Exception, 
                     context: Optional[Dict[str, Any]] = None,
                     logger_name: Optional[str] = None):
        """
        Log an exception with context information.
        
        Args:
            message: Descriptive message about the error
            exception: The exception that occurred
            context: Additional context information
            logger_name: Optional specific logger name
        """
        logger = self.get_logger(logger_name)
        
        context_str = ""
        if context:
            context_items = [f"{k}={v}" for k, v in context.items()]
            context_str = f" | Context: {', '.join(context_items)}"
        
        logger.error(f"{message} | Exception: {type(exception).__name__}: {str(exception)}{context_str}", 
                    exc_info=True)
    
    def log_request(self, 
                   method: str, 
                   url: str, 
                   status_code: Optional[int] = None,
                   response_time: Optional[float] = None,
                   error: Optional[str] = None):
        """
        Log HTTP request information.
        
        Args:
            method: HTTP method
            url: Request URL
            status_code: Response status code
            response_time: Response time in milliseconds
            error: Error message if request failed
        """
        logger = self.get_logger("HttpClient")
        
        if error:
            logger.warning(f"{method} {url} - FAILED: {error}")
        elif status_code:
            level = logging.INFO if status_code < 400 else logging.WARNING
            time_str = f" ({response_time:.1f}ms)" if response_time else ""
            logger.log(level, f"{method} {url} - {status_code}{time_str}")
        else:
            logger.debug(f"{method} {url} - Request initiated")
    
    def log_health_check(self, 
                        service_name: str, 
                        status: str, 
                        response_time: Optional[float] = None,
                        error: Optional[str] = None):
        """
        Log health check information.
        
        Args:
            service_name: Name of the service
            status: Health status
            response_time: Response time in milliseconds
            error: Error message if health check failed
        """
        logger = self.get_logger("HealthChecker")
        
        if error:
            logger.warning(f"Health check FAILED for {service_name}: {error}")
        else:
            time_str = f" ({response_time:.1f}ms)" if response_time else ""
            logger.info(f"Health check for {service_name}: {status}{time_str}")
    
    def log_user_action(self, action: str, details: Optional[str] = None):
        """
        Log user actions for debugging and analytics.
        
        Args:
            action: Description of the user action
            details: Additional details about the action
        """
        logger = self.get_logger("UserActions")
        
        message = f"User action: {action}"
        if details:
            message += f" | Details: {details}"
        
        logger.info(message)
    
    def set_log_level(self, level: LogLevel):
        """
        Change the logging level at runtime.
        
        Args:
            level: New log level
        """
        self.log_level = level
        self.logger.setLevel(level.value)
        
        # Update console handler level
        for handler in self.logger.handlers:
            if isinstance(handler, logging.StreamHandler) and handler.stream == sys.stdout:
                handler.setLevel(level.value)
        
        self.logger.info(f"Log level changed to {level.name}")
    
    def get_log_files(self) -> Dict[str, Path]:
        """
        Get paths to current log files.
        
        Returns:
            Dictionary mapping log types to file paths
        """
        return {
            "main": self.log_directory / f"{self.name.lower()}.log",
            "errors": self.log_directory / f"{self.name.lower()}_errors.log"
        }
    
    def cleanup_old_logs(self, days_to_keep: int = 30):
        """
        Clean up old log files.
        
        Args:
            days_to_keep: Number of days of logs to keep
        """
        try:
            cutoff_time = datetime.now().timestamp() - (days_to_keep * 24 * 60 * 60)
            
            for log_file in self.log_directory.glob("*.log*"):
                if log_file.stat().st_mtime < cutoff_time:
                    log_file.unlink()
                    self.logger.info(f"Cleaned up old log file: {log_file.name}")
        
        except Exception as e:
            self.logger.error(f"Error cleaning up old logs: {e}")


# Global logger instance
_global_logger: Optional[MCPDashboardLogger] = None


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Get the global logger instance.
    
    Args:
        name: Optional name for child logger
        
    Returns:
        Logger instance
    """
    global _global_logger
    
    if _global_logger is None:
        _global_logger = MCPDashboardLogger()
    
    return _global_logger.get_logger(name)


def initialize_logging(log_level: LogLevel = LogLevel.INFO,
                      log_to_file: bool = True,
                      log_to_console: bool = True,
                      log_directory: Optional[str] = None) -> MCPDashboardLogger:
    """
    Initialize the global logging system.
    
    Args:
        log_level: Minimum log level to capture
        log_to_file: Whether to log to file
        log_to_console: Whether to log to console
        log_directory: Directory for log files
        
    Returns:
        Initialized logger instance
    """
    global _global_logger
    
    _global_logger = MCPDashboardLogger(
        log_level=log_level,
        log_to_file=log_to_file,
        log_to_console=log_to_console,
        log_directory=log_directory
    )
    
    return _global_logger


def log_exception(message: str, 
                 exception: Exception, 
                 context: Optional[Dict[str, Any]] = None,
                 logger_name: Optional[str] = None):
    """
    Convenience function to log exceptions.
    
    Args:
        message: Descriptive message about the error
        exception: The exception that occurred
        context: Additional context information
        logger_name: Optional specific logger name
    """
    global _global_logger
    
    if _global_logger is None:
        _global_logger = MCPDashboardLogger()
    
    _global_logger.log_exception(message, exception, context, logger_name)