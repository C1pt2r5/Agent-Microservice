"""
Error handling utilities for MCP Dashboard application.
Provides centralized error handling, user-friendly error messages, and error dialogs.
"""
import tkinter as tk
from tkinter import messagebox
import traceback
from typing import Optional, Dict, Any, Callable, Union
from enum import Enum
from dataclasses import dataclass
from datetime import datetime
import logging

from .logger import get_logger


class ErrorSeverity(Enum):
    """Error severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """Categories of errors that can occur."""
    CONFIGURATION = "configuration"
    NETWORK = "network"
    SERVICE = "service"
    UI = "ui"
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    TIMEOUT = "timeout"
    UNKNOWN = "unknown"


@dataclass
class ErrorInfo:
    """Information about an error."""
    category: ErrorCategory
    severity: ErrorSeverity
    message: str
    technical_details: Optional[str] = None
    user_message: Optional[str] = None
    suggested_actions: Optional[list] = None
    timestamp: Optional[datetime] = None
    context: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
        
        if self.user_message is None:
            self.user_message = self._generate_user_friendly_message()
    
    def _generate_user_friendly_message(self) -> str:
        """Generate a user-friendly error message."""
        if self.category == ErrorCategory.CONFIGURATION:
            return "There's an issue with the application configuration. Please check your settings."
        
        elif self.category == ErrorCategory.NETWORK:
            return "Unable to connect to the service. Please check your network connection."
        
        elif self.category == ErrorCategory.SERVICE:
            return "The service is currently unavailable. Please try again later."
        
        elif self.category == ErrorCategory.AUTHENTICATION:
            return "Authentication failed. Please check your credentials."
        
        elif self.category == ErrorCategory.TIMEOUT:
            return "The request took too long to complete. Please try again."
        
        elif self.category == ErrorCategory.VALIDATION:
            return "The provided input is not valid. Please check and try again."
        
        elif self.category == ErrorCategory.UI:
            return "An interface error occurred. Please restart the application if the problem persists."
        
        else:
            return "An unexpected error occurred. Please try again or contact support."


class ErrorHandler:
    """
    Centralized error handler for the MCP Dashboard application.
    """
    
    def __init__(self, parent_window: Optional[tk.Tk] = None):
        """Initialize error handler."""
        self.parent_window = parent_window
        self.logger = get_logger("ErrorHandler")
        self.error_callbacks: Dict[ErrorCategory, list] = {}
        self.error_history: list = []
        self.max_history_size = 100
    
    def handle_error(self, 
                    error: Union[Exception, ErrorInfo], 
                    context: Optional[Dict[str, Any]] = None,
                    show_dialog: bool = True,
                    callback: Optional[Callable] = None) -> ErrorInfo:
        """Handle an error with appropriate logging and user notification."""
        # Convert exception to ErrorInfo if needed
        if isinstance(error, Exception):
            error_info = self._exception_to_error_info(error, context)
        else:
            error_info = error
            if context:
                error_info.context = {**(error_info.context or {}), **context}
        
        # Log the error
        self._log_error(error_info)
        
        # Add to error history
        self._add_to_history(error_info)
        
        # Show user dialog if requested
        if show_dialog:
            self._show_error_dialog(error_info)
        
        # Execute callbacks
        self._execute_callbacks(error_info)
        
        if callback:
            try:
                callback(error_info)
            except Exception as e:
                self.logger.error(f"Error in error callback: {e}")
        
        return error_info
    
    def _exception_to_error_info(self, 
                                exception: Exception, 
                                context: Optional[Dict[str, Any]] = None) -> ErrorInfo:
        """Convert an exception to ErrorInfo."""
        category = self._categorize_exception(exception)
        severity = self._determine_severity(exception, category)
        
        technical_details = f"{type(exception).__name__}: {str(exception)}"
        if hasattr(exception, '__traceback__') and exception.__traceback__:
            technical_details += f"\n\nTraceback:\n{''.join(traceback.format_tb(exception.__traceback__))}"
        
        suggested_actions = self._generate_suggested_actions(category, exception)
        
        return ErrorInfo(
            category=category,
            severity=severity,
            message=str(exception),
            technical_details=technical_details,
            suggested_actions=suggested_actions,
            context=context
        )
    
    def _categorize_exception(self, exception: Exception) -> ErrorCategory:
        """Categorize an exception based on its type and message."""
        exception_type = type(exception).__name__
        exception_message = str(exception).lower()
        
        # Network-related errors
        if any(keyword in exception_type.lower() for keyword in 
               ['connection', 'timeout', 'network', 'socket', 'http']):
            return ErrorCategory.NETWORK
        
        if any(keyword in exception_message for keyword in 
               ['connection', 'timeout', 'network', 'unreachable', 'refused']):
            return ErrorCategory.NETWORK
        
        # Configuration errors
        if any(keyword in exception_message for keyword in 
               ['config', 'setting', 'environment', 'missing', 'not found']):
            return ErrorCategory.CONFIGURATION
        
        # Authentication errors
        if any(keyword in exception_message for keyword in 
               ['auth', 'credential', 'token', 'unauthorized', 'forbidden']):
            return ErrorCategory.AUTHENTICATION
        
        # Validation errors
        if any(keyword in exception_type.lower() for keyword in 
               ['value', 'type', 'attribute', 'key']):
            return ErrorCategory.VALIDATION
        
        # UI errors
        if any(keyword in exception_type.lower() for keyword in 
               ['tk', 'widget', 'gui', 'display']):
            return ErrorCategory.UI
        
        # Service errors
        if any(keyword in exception_message for keyword in 
               ['service', 'server', 'api', 'endpoint']):
            return ErrorCategory.SERVICE
        
        return ErrorCategory.UNKNOWN
    
    def _determine_severity(self, exception: Exception, category: ErrorCategory) -> ErrorSeverity:
        """Determine error severity based on exception and category."""
        if isinstance(exception, (SystemExit, KeyboardInterrupt)):
            return ErrorSeverity.CRITICAL
        
        if category == ErrorCategory.CONFIGURATION and "required" in str(exception).lower():
            return ErrorSeverity.CRITICAL
        
        if category in [ErrorCategory.NETWORK, ErrorCategory.SERVICE, ErrorCategory.AUTHENTICATION]:
            return ErrorSeverity.ERROR
        
        if category in [ErrorCategory.VALIDATION, ErrorCategory.TIMEOUT]:
            return ErrorSeverity.WARNING
        
        return ErrorSeverity.ERROR
    
    def _generate_suggested_actions(self, category: ErrorCategory, exception: Exception) -> list:
        """Generate suggested actions based on error category."""
        actions = []
        
        if category == ErrorCategory.NETWORK:
            actions.extend([
                "Check your internet connection",
                "Verify the service URL is correct",
                "Try again in a few moments",
                "Check if the service is running"
            ])
        
        elif category == ErrorCategory.CONFIGURATION:
            actions.extend([
                "Check your .env configuration file",
                "Verify all required settings are present",
                "Restart the application",
                "Check the documentation for configuration requirements"
            ])
        
        elif category == ErrorCategory.SERVICE:
            actions.extend([
                "Check if the service is running",
                "Verify the service endpoint URL",
                "Try refreshing the service list",
                "Contact the service administrator"
            ])
        
        elif category == ErrorCategory.AUTHENTICATION:
            actions.extend([
                "Check your authentication credentials",
                "Verify your API key or token",
                "Check if your credentials have expired",
                "Contact your administrator for access"
            ])
        
        elif category == ErrorCategory.TIMEOUT:
            actions.extend([
                "Try the request again",
                "Check your network connection",
                "Increase timeout settings if possible",
                "Try with a smaller request"
            ])
        
        elif category == ErrorCategory.VALIDATION:
            actions.extend([
                "Check your input format",
                "Verify all required fields are filled",
                "Check for special characters or invalid data",
                "Refer to the API documentation"
            ])
        
        elif category == ErrorCategory.UI:
            actions.extend([
                "Try refreshing the interface",
                "Restart the application",
                "Check if your display settings are correct",
                "Report this issue if it persists"
            ])
        
        else:
            actions.extend([
                "Try the operation again",
                "Restart the application if the problem persists",
                "Check the application logs for more details",
                "Contact support if the issue continues"
            ])
        
        return actions
    
    def _log_error(self, error_info: ErrorInfo):
        """Log error information."""
        context_str = ""
        if error_info.context:
            context_items = [f"{k}={v}" for k, v in error_info.context.items()]
            context_str = f" | Context: {', '.join(context_items)}"
        
        log_message = f"[{error_info.category.value.upper()}] {error_info.message}{context_str}"
        
        if error_info.severity == ErrorSeverity.CRITICAL:
            self.logger.critical(log_message)
        elif error_info.severity == ErrorSeverity.ERROR:
            self.logger.error(log_message)
        elif error_info.severity == ErrorSeverity.WARNING:
            self.logger.warning(log_message)
        else:
            self.logger.info(log_message)
        
        if error_info.technical_details:
            self.logger.debug(f"Technical details: {error_info.technical_details}")
    
    def _add_to_history(self, error_info: ErrorInfo):
        """Add error to history."""
        self.error_history.append(error_info)
        
        if len(self.error_history) > self.max_history_size:
            self.error_history = self.error_history[-self.max_history_size:]
    
    def _show_error_dialog(self, error_info: ErrorInfo):
        """Show appropriate error dialog to user."""
        if not self.parent_window:
            return
        
        try:
            if error_info.severity == ErrorSeverity.INFO:
                messagebox.showinfo(
                    "Information",
                    error_info.user_message,
                    parent=self.parent_window
                )
            
            elif error_info.severity == ErrorSeverity.WARNING:
                messagebox.showwarning(
                    "Warning",
                    error_info.user_message,
                    parent=self.parent_window
                )
            
            elif error_info.severity == ErrorSeverity.ERROR:
                self._show_detailed_error_dialog(error_info)
            
            elif error_info.severity == ErrorSeverity.CRITICAL:
                messagebox.showerror(
                    "Critical Error",
                    f"{error_info.user_message}\n\nThe application may need to be restarted.",
                    parent=self.parent_window
                )
        
        except Exception as e:
            self.logger.error(f"Error showing error dialog: {e}")
    
    def _show_detailed_error_dialog(self, error_info: ErrorInfo):
        """Show detailed error dialog with options."""
        try:
            # Create custom dialog
            dialog = tk.Toplevel(self.parent_window)
            dialog.title("Error Details")
            dialog.geometry("500x400")
            dialog.resizable(True, True)
            
            dialog.transient(self.parent_window)
            dialog.grab_set()
            
            # Main frame
            main_frame = tk.Frame(dialog, padx=20, pady=20)
            main_frame.pack(fill=tk.BOTH, expand=True)
            
            # Error message
            message_label = tk.Label(
                main_frame,
                text=error_info.user_message,
                font=('Segoe UI', 10, 'bold'),
                wraplength=450,
                justify=tk.LEFT
            )
            message_label.pack(anchor=tk.W, pady=(0, 10))
            
            # Suggested actions
            if error_info.suggested_actions:
                actions_label = tk.Label(
                    main_frame,
                    text="Suggested actions:",
                    font=('Segoe UI', 9, 'bold')
                )
                actions_label.pack(anchor=tk.W, pady=(10, 5))
                
                for action in error_info.suggested_actions[:4]:
                    action_label = tk.Label(
                        main_frame,
                        text=f"• {action}",
                        font=('Segoe UI', 9),
                        wraplength=450,
                        justify=tk.LEFT
                    )
                    action_label.pack(anchor=tk.W, padx=(10, 0))
            
            # Button frame
            button_frame = tk.Frame(main_frame)
            button_frame.pack(fill=tk.X, pady=(20, 0))
            
            # Close button
            close_button = tk.Button(
                button_frame,
                text="Close",
                command=dialog.destroy
            )
            close_button.pack(side=tk.RIGHT)
            close_button.focus_set()
            
            dialog.protocol("WM_DELETE_WINDOW", dialog.destroy)
            
        except Exception as e:
            self.logger.error(f"Error creating detailed error dialog: {e}")
            messagebox.showerror(
                "Error",
                error_info.user_message,
                parent=self.parent_window
            )
    
    def _execute_callbacks(self, error_info: ErrorInfo):
        """Execute registered callbacks for error category."""
        callbacks = self.error_callbacks.get(error_info.category, [])
        
        for callback in callbacks:
            try:
                callback(error_info)
            except Exception as e:
                self.logger.error(f"Error in error callback: {e}")
    
    def register_error_callback(self, category: ErrorCategory, callback: Callable):
        """Register a callback for specific error categories."""
        if category not in self.error_callbacks:
            self.error_callbacks[category] = []
        
        self.error_callbacks[category].append(callback)
    
    def get_error_history(self, category: Optional[ErrorCategory] = None) -> list:
        """Get error history, optionally filtered by category."""
        if category:
            return [error for error in self.error_history if error.category == category]
        return self.error_history.copy()
    
    def clear_error_history(self):
        """Clear error history."""
        self.error_history.clear()
        self.logger.info("Error history cleared")


# Global error handler instance
_global_error_handler: Optional[ErrorHandler] = None


def get_error_handler(parent_window: Optional[tk.Tk] = None) -> ErrorHandler:
    """Get the global error handler instance."""
    global _global_error_handler
    
    if _global_error_handler is None:
        _global_error_handler = ErrorHandler(parent_window)
    elif parent_window and _global_error_handler.parent_window != parent_window:
        _global_error_handler.parent_window = parent_window
    
    return _global_error_handler


def handle_error(error: Union[Exception, ErrorInfo], 
                context: Optional[Dict[str, Any]] = None,
                show_dialog: bool = True,
                parent_window: Optional[tk.Tk] = None) -> ErrorInfo:
    """Convenience function to handle errors."""
    error_handler = get_error_handler(parent_window)
    return error_handler.handle_error(error, context, show_dialog)