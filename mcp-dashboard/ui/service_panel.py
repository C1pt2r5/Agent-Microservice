"""
Service interaction panel for endpoint testing and request execution.
Provides interface for making requests to specific services with response display.
"""
import tkinter as tk
from tkinter import ttk, messagebox
import asyncio
import json
import logging
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime

from services.service_manager import ServiceManager, ServiceExecutionResult, EndpointInfo
from services.health_checker import HealthStatus
from config.service_config import ServiceConfig
from .components.json_viewer import JsonViewer
from .components.request_form import RequestForm
from .components.sample_endpoints_panel import SampleEndpointsPanel
from utils.error_handler import get_error_handler, handle_error, ErrorCategory, ErrorSeverity


class ServicePanel(ttk.Frame):
    """
    Service-specific interaction panel for endpoint testing.
    
    Provides interface for making HTTP requests to a specific service,
    displaying responses, and managing sample endpoints.
    """
    
    def __init__(
        self, 
        parent, 
        service_manager: ServiceManager,
        service_name: str,
        event_loop: Optional[asyncio.AbstractEventLoop] = None,
        **kwargs
    ):
        """
        Initialize service panel for a specific service.
        
        Args:
            parent: Parent widget
            service_manager: Service manager instance
            service_name: Name of the service this panel represents
            event_loop: Optional asyncio event loop for async operations
            **kwargs: Additional arguments for ttk.Frame
        """
        super().__init__(parent, **kwargs)
        
        self.service_manager = service_manager
        self.service_name = service_name
        self.event_loop = event_loop
        self.logger = logging.getLogger(f"ServicePanel-{service_name}")
        
        # Service configuration
        self.service_config: Optional[ServiceConfig] = None
        self.sample_endpoints: List[EndpointInfo] = []
        
        # UI components
        self.request_form: Optional[RequestForm] = None
        self.response_viewer: Optional[JsonViewer] = None
        self.sample_buttons_frame: Optional[ttk.Frame] = None
        self.status_label: Optional[ttk.Label] = None
        
        # Request state
        self.current_request_future: Optional[asyncio.Future] = None
        self.request_in_progress = False
        
        # Request history
        self.request_history: List[Dict[str, Any]] = []
        self.max_history_size = 50
        
        # Error handling
        self.error_handler = None
        
        # Initialize the panel
        self._initialize_service_data()
        self._setup_error_handling()
        self._create_widgets()
        self._setup_layout()
        self._load_sample_endpoints()
        self._setup_response_controls()
    
    def _initialize_service_data(self):
        """Initialize service configuration and data."""
        self.service_config = self.service_manager.get_service_config(self.service_name)
        if not self.service_config:
            self.logger.error(f"Service configuration not found: {self.service_name}")
            return
        
        self.sample_endpoints = self.service_manager.get_sample_endpoints(self.service_name)
        self.logger.info(f"Initialized service panel for {self.service_name} with {len(self.sample_endpoints)} sample endpoints")
    
    def _setup_error_handling(self):
        """Set up error handling for the service panel."""
        try:
            self.error_handler = get_error_handler()
            self.logger.info(f"Error handling initialized for service panel: {self.service_name}")
        except Exception as e:
            self.logger.error(f"Failed to setup error handling: {e}")
    
    def _handle_panel_error(self, error: Exception, context: str = "", show_dialog: bool = True):
        """
        Handle errors within the service panel.
        
        Args:
            error: The exception that occurred
            context: Additional context about where the error occurred
            show_dialog: Whether to show error dialog to user
        """
        try:
            if self.error_handler:
                error_info = self.error_handler.handle_error(
                    error,
                    context={
                        'service_name': self.service_name,
                        'panel_context': context
                    },
                    show_dialog=show_dialog
                )
                
                # Update status with user-friendly message
                self._update_status(f"Error: {error_info.user_message}")
                
            else:
                # Fallback error handling
                self.logger.error(f"Panel error in {context}: {error}", exc_info=True)
                self._update_status(f"Error in {context}: {str(error)}")
                
                if show_dialog:
                    messagebox.showerror("Error", f"An error occurred: {str(error)}")
                    
        except Exception as e:
            # Last resort error handling
            self.logger.critical(f"Critical error in error handling: {e}", exc_info=True)
            self._update_status("Critical error occurred")
    
    def _create_widgets(self):
        """Create the UI widgets for the service panel."""
        # Service header
        self.header_frame = ttk.Frame(self)
        
        self.service_title = ttk.Label(
            self.header_frame,
            text=f"Service: {self.service_name}",
            font=('Segoe UI', 12, 'bold')
        )
        
        if self.service_config:
            self.endpoint_label = ttk.Label(
                self.header_frame,
                text=f"Endpoint: {self.service_config.endpoint}",
                font=('Segoe UI', 9),
                foreground='gray'
            )
        
        # Sample endpoints section
        self.sample_section_frame = ttk.LabelFrame(self, text="Sample Endpoints", padding=10)
        
        # Create enhanced sample endpoints panel
        self.sample_endpoints_panel = SampleEndpointsPanel(
            self.sample_section_frame,
            service_name=self.service_name,
            endpoints=self.sample_endpoints,
            on_endpoint_selected=self._on_sample_endpoint_selected,
            on_endpoint_executed=self._on_sample_endpoint_executed
        )
        
        # Request form section
        self.request_section_frame = ttk.LabelFrame(self, text="Custom Request", padding=10)
        self.request_form = RequestForm(
            self.request_section_frame,
            on_send_request=self._on_send_request
        )
        
        # Add clear response button
        self.clear_response_button = ttk.Button(
            self.request_section_frame,
            text="Clear Response",
            command=self._on_clear_response
        )
        
        # Response section
        self.response_section_frame = ttk.LabelFrame(self, text="Response", padding=10)
        
        # Response controls frame
        self.response_controls_frame = ttk.Frame(self.response_section_frame)
        
        # Response type tabs
        self.response_notebook = ttk.Notebook(self.response_section_frame)
        
        # Response tab
        self.response_tab_frame = ttk.Frame(self.response_notebook)
        self.response_notebook.add(self.response_tab_frame, text="Response")
        self.response_viewer = JsonViewer(self.response_tab_frame)
        
        # History tab
        self.history_tab_frame = ttk.Frame(self.response_notebook)
        self.response_notebook.add(self.history_tab_frame, text="History")
        self._create_history_tab()
        
        # Response controls
        self.clear_response_btn = ttk.Button(
            self.response_controls_frame,
            text="Clear Response",
            command=self._on_clear_response
        )
        
        self.copy_response_btn = ttk.Button(
            self.response_controls_frame,
            text="Copy Response",
            command=self._copy_response_to_clipboard
        )
        
        self.save_response_btn = ttk.Button(
            self.response_controls_frame,
            text="Save Response",
            command=self._save_response_to_file
        )
        
        self.format_response_btn = ttk.Button(
            self.response_controls_frame,
            text="Format JSON",
            command=self._format_response_json
        )
        
        # Status section
        self.status_frame = ttk.Frame(self)
        self.status_label = ttk.Label(
            self.status_frame,
            text="Ready to send requests",
            font=('Segoe UI', 9),
            foreground='gray'
        )
    
    def _setup_layout(self):
        """Set up the layout of widgets."""
        # Configure grid weights
        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)  # Sample endpoints section expands
        self.rowconfigure(2, weight=1)  # Request section expands
        self.rowconfigure(3, weight=2)  # Response section expands more
        
        # Header
        self.header_frame.grid(row=0, column=0, sticky='ew', padx=5, pady=(5, 10))
        self.header_frame.columnconfigure(0, weight=1)
        
        self.service_title.grid(row=0, column=0, sticky='w')
        if hasattr(self, 'endpoint_label'):
            self.endpoint_label.grid(row=1, column=0, sticky='w', pady=(2, 0))
        
        # Sample endpoints
        self.sample_section_frame.grid(row=1, column=0, sticky='nsew', padx=5, pady=5)
        self.sample_section_frame.columnconfigure(0, weight=1)
        self.sample_section_frame.rowconfigure(0, weight=1)
        
        self.sample_endpoints_panel.grid(row=0, column=0, sticky='nsew')
        
        # Request form
        self.request_section_frame.grid(row=2, column=0, sticky='nsew', padx=5, pady=5)
        self.request_section_frame.columnconfigure(0, weight=1)
        self.request_section_frame.rowconfigure(0, weight=1)
        
        self.request_form.grid(row=0, column=0, sticky='nsew')
        self.clear_response_button.grid(row=1, column=0, sticky='e', padx=5, pady=(5, 0))
        
        # Response viewer
        self.response_section_frame.grid(row=3, column=0, sticky='nsew', padx=5, pady=5)
        self.response_section_frame.columnconfigure(0, weight=1)
        self.response_section_frame.rowconfigure(1, weight=1)
        
        # Response controls
        self.response_controls_frame.grid(row=0, column=0, sticky='ew', pady=(0, 5))
        self.clear_response_btn.grid(row=0, column=0, padx=(0, 5))
        self.copy_response_btn.grid(row=0, column=1, padx=(0, 5))
        self.save_response_btn.grid(row=0, column=2, padx=(0, 5))
        self.format_response_btn.grid(row=0, column=3, padx=(0, 5))
        
        # Response notebook
        self.response_notebook.grid(row=1, column=0, sticky='nsew')
        
        # Response tab content
        self.response_tab_frame.columnconfigure(0, weight=1)
        self.response_tab_frame.rowconfigure(0, weight=1)
        self.response_viewer.grid(row=0, column=0, sticky='nsew')
        
        # Status
        self.status_frame.grid(row=4, column=0, sticky='ew', padx=5, pady=(5, 10))
        self.status_frame.columnconfigure(0, weight=1)
        
        self.status_label.grid(row=0, column=0, sticky='w')
    
    def _load_sample_endpoints(self):
        """Load and display sample endpoints in the enhanced panel."""
        if hasattr(self, 'sample_endpoints_panel'):
            self.sample_endpoints_panel.update_endpoints(self.sample_endpoints)
    
    def _on_sample_endpoint_selected(self, endpoint: EndpointInfo):
        """
        Handle selection of a sample endpoint.
        
        Args:
            endpoint: Selected endpoint information
        """
        self.logger.info(f"Sample endpoint selected: {endpoint}")
        
        # Update request form with endpoint data
        self.request_form.set_endpoint(endpoint.path)
        self.request_form.set_method(endpoint.method)
        
        # Set sample payload if available
        if endpoint.sample_payload:
            self.request_form.set_request_body(json.dumps(endpoint.sample_payload, indent=2))
        else:
            self.request_form.clear_request_body()
        
        # Update status
        self._update_status(f"Loaded sample endpoint: {endpoint.method} {endpoint.path}")
    
    def _on_sample_endpoint_executed(self, endpoint: EndpointInfo):
        """
        Handle execution of a sample endpoint directly.
        
        Args:
            endpoint: Selected endpoint information
        """
        try:
            self.logger.info(f"Executing sample endpoint: {endpoint}")
            
            # First select the endpoint to populate the form
            self._on_sample_endpoint_selected(endpoint)
            
            # Then execute the request
            headers = {}
            if endpoint.sample_payload:
                headers['Content-Type'] = 'application/json'
            
            # Add any additional headers from endpoint definition
            if hasattr(endpoint, 'headers') and endpoint.headers:
                headers.update(endpoint.headers)
            
            body = ""
            if endpoint.sample_payload:
                body = json.dumps(endpoint.sample_payload, indent=2)
            
            # Execute the request
            self._execute_request(endpoint.path, endpoint.method, headers, body)
            
            # Update status
            self._update_status(f"Executing sample endpoint: {endpoint.method} {endpoint.path}")
            
        except Exception as e:
            self._handle_panel_error(e, "sample_endpoint_execution")
    
    def _on_send_request(self, endpoint: str, method: str, headers: Dict[str, str], body: str):
        """
        Handle send request action from the request form.
        
        Args:
            endpoint: API endpoint path
            method: HTTP method
            headers: Request headers
            body: Request body
        """
        try:
            if self.request_in_progress:
                self.logger.warning("Request already in progress")
                self._update_status("Request already in progress")
                return
            
            self.logger.info(f"Sending request: {method} {endpoint}")
            
            # Enhanced input validation
            validation_errors = self._validate_request_inputs(endpoint, method, headers, body)
            if validation_errors:
                error_message = "Request validation failed:\n" + "\n".join(validation_errors)
                self._handle_panel_error(
                    ValueError(error_message), 
                    "request_validation", 
                    show_dialog=True
                )
                return
            
            # Start the request
            self._execute_request(endpoint.strip(), method, headers, body)
            
        except Exception as e:
            self._handle_panel_error(e, "send_request")
    
    def _validate_request_inputs(self, endpoint: str, method: str, headers: Dict[str, str], body: str) -> List[str]:
        """
        Validate request inputs and return list of errors.
        
        Args:
            endpoint: API endpoint path
            method: HTTP method
            headers: Request headers
            body: Request body
            
        Returns:
            List of validation error messages
        """
        errors = []
        
        # Validate endpoint
        if not endpoint or not endpoint.strip():
            errors.append("• Endpoint path is required")
        elif not endpoint.startswith('/'):
            errors.append("• Endpoint path should start with '/'")
        
        # Validate method
        valid_methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
        if method.upper() not in valid_methods:
            errors.append(f"• Invalid HTTP method: {method}")
        
        # Validate headers
        if headers:
            for key, value in headers.items():
                if not key.strip():
                    errors.append("• Header names cannot be empty")
                if ':' in key:
                    errors.append(f"• Invalid header name: {key} (contains ':')")
        
        # Validate body for methods that support it
        if method.upper() in ['POST', 'PUT', 'PATCH'] and body.strip():
            # Try to validate JSON if Content-Type suggests JSON
            content_type = headers.get('Content-Type', '').lower() if headers else ''
            if 'json' in content_type or (not content_type and body.strip().startswith(('{',' ['))):
                try:
                    json.loads(body)
                except json.JSONDecodeError as e:
                    errors.append(f"• Invalid JSON in request body: {str(e)}")
        
        return errors
    
    def _on_clear_response(self):
        """Handle clear response action."""
        self.response_viewer.clear()
        self._update_status("Response cleared")
    
    def _execute_request(self, endpoint: str, method: str, headers: Dict[str, str], body: str):
        """
        Execute the HTTP request asynchronously.
        
        Args:
            endpoint: API endpoint path
            method: HTTP method
            headers: Request headers
            body: Request body
        """
        try:
            if not self.event_loop:
                error_msg = "No event loop available for async operations"
                self._handle_panel_error(
                    RuntimeError(error_msg), 
                    "execute_request", 
                    show_dialog=True
                )
                return
            
            # Store request data for history
            self._last_request_headers = headers.copy() if headers else {}
            self._last_request_body = body if body else ''
            
            # Prepare request parameters
            kwargs = {}
            
            # Add headers
            if headers:
                kwargs['headers'] = headers
            
            # Add body for methods that support it
            if method.upper() in ['POST', 'PUT', 'PATCH'] and body.strip():
                try:
                    # Try to parse as JSON
                    json_body = json.loads(body)
                    kwargs['json'] = json_body
                    if 'headers' not in kwargs:
                        kwargs['headers'] = {}
                    kwargs['headers']['Content-Type'] = 'application/json'
                except json.JSONDecodeError:
                    # Use as raw text
                    kwargs['data'] = body
                    if 'headers' not in kwargs:
                        kwargs['headers'] = {}
                    if 'Content-Type' not in kwargs['headers']:
                        kwargs['headers']['Content-Type'] = 'text/plain'
            
            # Update UI state
            self.request_in_progress = True
            self.request_form.set_loading_state(True)
            self._update_status(f"Sending {method} request to {endpoint}...")
            
            # Add progress tracking
            self._request_start_time = datetime.now()
            self._progress_counter = 0
            
            # Disable response controls during request
            self.copy_response_btn.configure(state='disabled')
            self.save_response_btn.configure(state='disabled')
            self.format_response_btn.configure(state='disabled')
            
            # Clear previous response
            self.response_viewer.clear()
            
            # Execute request asynchronously
            self.current_request_future = asyncio.run_coroutine_threadsafe(
                self._async_execute_request(endpoint, method, kwargs),
                self.event_loop
            )
            
            # Schedule result handling with progress updates
            self._schedule_progress_update()
            self.after(100, self._check_request_result)
            
        except Exception as e:
            self.logger.error(f"Error starting request: {e}")
            self._handle_request_error(f"Failed to start request: {str(e)}")
            self._handle_panel_error(e, "execute_request_async")
    
    def _schedule_progress_update(self):
        """Schedule periodic progress updates during request execution."""
        if self.request_in_progress:
            self._progress_counter += 1
            elapsed = (datetime.now() - self._request_start_time).total_seconds()
            
            # Update status with elapsed time
            dots = "." * (self._progress_counter % 4)
            self._update_status(f"Request in progress{dots} ({elapsed:.1f}s)")
            
            # Schedule next update
            self.after(500, self._schedule_progress_update)
    
    async def _async_execute_request(self, endpoint: str, method: str, kwargs: Dict[str, Any]) -> ServiceExecutionResult:
        """
        Execute the HTTP request asynchronously.
        
        Args:
            endpoint: API endpoint path
            method: HTTP method
            kwargs: Request parameters
            
        Returns:
            ServiceExecutionResult with request outcome
        """
        try:
            result = await self.service_manager.execute_request(
                service_name=self.service_name,
                endpoint=endpoint,
                method=method,
                **kwargs
            )
            return result
            
        except Exception as e:
            self.logger.error(f"Request execution error: {e}")
            # Create error result
            from services.http_client import RequestResult
            error_result = RequestResult(
                success=False,
                status_code=500,
                response_data={},
                response_time=0,
                error_message=str(e)
            )
            
            from services.service_manager import ServiceExecutionResult
            return ServiceExecutionResult(
                service_name=self.service_name,
                endpoint=endpoint,
                method=method,
                success=False,
                request_result=error_result,
                execution_time=datetime.now()
            )
    
    def _check_request_result(self):
        """Check if the async request has completed."""
        if not self.current_request_future:
            return
        
        if self.current_request_future.done():
            try:
                result = self.current_request_future.result()
                self._handle_request_result(result)
            except Exception as e:
                self.logger.error(f"Request result error: {e}")
                self._handle_request_error(f"Request failed: {str(e)}")
            finally:
                self.current_request_future = None
        else:
            # Check again in 100ms
            self.after(100, self._check_request_result)
    
    def _handle_request_result(self, result: ServiceExecutionResult):
        """
        Handle the result of a completed request.
        
        Args:
            result: Service execution result
        """
        self.logger.info(f"Request completed: {result.success}, Status: {result.status_code}, Time: {result.response_time:.2f}ms")
        
        # Update UI state
        self.request_in_progress = False
        self.request_form.set_loading_state(False)
        
        # Handle different response types
        self._display_response_by_type(result)
        
        # Enable response control buttons
        self.copy_response_btn.configure(state='normal')
        self.save_response_btn.configure(state='normal')
        self.format_response_btn.configure(state='normal')
        
        # Add to request history
        request_data = {
            'method': result.method,
            'endpoint': result.endpoint,
            'headers': getattr(self, '_last_request_headers', {}),
            'body': getattr(self, '_last_request_body', '')
        }
        self._add_to_request_history(request_data, result)
        
        # Update status with enhanced information
        if result.success:
            status_msg = f"✓ {result.status_code} - {result.response_time:.1f}ms"
            if result.response_data and isinstance(result.response_data, dict):
                data_size = len(str(result.response_data))
                status_msg += f" ({data_size} chars)"
            self._update_status(status_msg)
        else:
            error_msg = result.error_message or 'Unknown error'
            self._update_status(f"✗ Request failed: {error_msg}")
        
        # Show notification for significant response times
        if result.response_time and result.response_time > 5000:  # > 5 seconds
            self._show_slow_response_notification(result.response_time)
    
    def _display_response_by_type(self, result: ServiceExecutionResult):
        """
        Display response based on its type and content.
        
        Args:
            result: Service execution result to display
        """
        try:
            if result.success:
                # Successful response
                response_data = result.response_data
                
                if isinstance(response_data, dict):
                    # JSON response
                    title = f"Response ({result.status_code}) - {result.response_time:.1f}ms"
                    self.response_viewer.display_json(response_data, title)
                elif isinstance(response_data, list):
                    # JSON array response
                    title = f"Response ({result.status_code}) - {result.response_time:.1f}ms"
                    self.response_viewer.display_json(response_data, title)
                elif isinstance(response_data, str):
                    # Text response
                    title = f"Text Response ({result.status_code}) - {result.response_time:.1f}ms"
                    self.response_viewer.display_plain_text(response_data, title)
                else:
                    # Other response types
                    title = f"Response ({result.status_code}) - {result.response_time:.1f}ms"
                    self.response_viewer.display_json({"data": str(response_data)}, title)
            else:
                # Error response
                error_data = {
                    "error": True,
                    "status_code": result.status_code,
                    "message": result.error_message or "Unknown error",
                    "service": result.service_name,
                    "endpoint": result.endpoint,
                    "method": result.method,
                    "timestamp": result.execution_time.isoformat(),
                    "response_time": result.response_time
                }
                
                # Add response data if available
                if result.response_data:
                    error_data["response_data"] = result.response_data
                
                # Add circuit breaker info if triggered
                if hasattr(result.request_result, 'circuit_breaker_triggered') and result.request_result.circuit_breaker_triggered:
                    error_data["circuit_breaker"] = "Circuit breaker is open"
                
                # Add retry info if available
                if hasattr(result.request_result, 'retry_attempts') and result.request_result.retry_attempts > 0:
                    error_data["retry_attempts"] = result.request_result.retry_attempts
                
                title = f"Error ({result.status_code}) - {result.error_message or 'Request Failed'}"
                self.response_viewer.display_json(error_data, title)
                
        except Exception as e:
            self.logger.error(f"Error displaying response: {e}")
            # Fallback error display
            self.response_viewer.display_error(
                f"Failed to display response: {str(e)}",
                f"Original result: {result}"
            )

    def _show_slow_response_notification(self, response_time: float):
        """Show notification for slow responses."""
        try:
            from tkinter import messagebox
            messagebox.showwarning(
                "Slow Response",
                f"Request took {response_time/1000:.1f} seconds to complete.\n"
                f"Consider checking service performance or network connectivity."
            )
        except Exception as e:
            self.logger.error(f"Error showing slow response notification: {e}")
    
    def _handle_request_error(self, error_message: str):
        """
        Handle request execution errors.
        
        Args:
            error_message: Error message to display
        """
        try:
            self.logger.error(f"Request error: {error_message}")
            
            # Update UI state
            self.request_in_progress = False
            self.request_form.set_loading_state(False)
            
            # Enhanced error data
            error_data = {
                'error': True,
                'message': error_message,
                'timestamp': datetime.now().isoformat(),
                'service_name': self.service_name,
                'endpoint': getattr(self, '_last_request_endpoint', ''),
                'method': getattr(self, '_last_request_method', ''),
                'troubleshooting': self._generate_troubleshooting_tips(error_message),
                'service_health': self._get_service_health_info()
            }
            
            # Use error handler for consistent error processing
            if self.error_handler:
                from utils.error_handler import ErrorInfo, ErrorCategory, ErrorSeverity
                
                # Determine error category based on message
                category = self._categorize_request_error(error_message)
                
                error_info = ErrorInfo(
                    category=category,
                    severity=ErrorSeverity.ERROR,
                    message=error_message,
                    context={
                        'service_name': self.service_name,
                        'endpoint': getattr(self, '_last_request_endpoint', ''),
                        'method': getattr(self, '_last_request_method', '')
                    },
                    suggested_actions=self._generate_troubleshooting_tips(error_message)
                )
                
                self.error_handler.handle_error(error_info, show_dialog=False)
            
            # Display error in response viewer
            self.response_viewer.display_json(error_data, f"Request Error - {error_message}")
            
            # Enable response control buttons for error data
            self.copy_response_btn.configure(state='normal')
            self.save_response_btn.configure(state='normal')
            
            # Update status
            self._update_status(f"✗ Request error: {error_message}")
            
            # Show enhanced error dialog with troubleshooting tips
            self._show_enhanced_error_dialog(error_message)
            
        except Exception as e:
            # Fallback error handling
            self.logger.critical(f"Critical error in request error handling: {e}", exc_info=True)
            self._update_status("Critical error occurred during request error handling")
    
    def _categorize_request_error(self, error_message: str) -> ErrorCategory:
        """
        Categorize request error based on message content.
        
        Args:
            error_message: Error message to categorize
            
        Returns:
            ErrorCategory for the error
        """
        error_lower = error_message.lower()
        
        if any(keyword in error_lower for keyword in ['connection', 'network', 'unreachable', 'refused']):
            return ErrorCategory.NETWORK
        elif any(keyword in error_lower for keyword in ['timeout', 'timed out']):
            return ErrorCategory.TIMEOUT
        elif any(keyword in error_lower for keyword in ['401', 'unauthorized', 'forbidden', 'auth']):
            return ErrorCategory.AUTHENTICATION
        elif any(keyword in error_lower for keyword in ['400', 'bad request', 'invalid']):
            return ErrorCategory.VALIDATION
        elif any(keyword in error_lower for keyword in ['500', 'internal server', 'service']):
            return ErrorCategory.SERVICE
        else:
            return ErrorCategory.UNKNOWN
    
    def _get_service_health_info(self) -> Dict[str, Any]:
        """Get current service health information for error context."""
        try:
            health_info = self.service_manager.get_service_health(self.service_name)
            if health_info:
                return {
                    'status': health_info.status.value,
                    'last_check': health_info.last_check.isoformat() if health_info.last_check else None,
                    'response_time': health_info.response_time,
                    'uptime_percentage': health_info.uptime_percentage,
                    'consecutive_failures': health_info.consecutive_failures
                }
        except Exception as e:
            self.logger.error(f"Error getting service health info: {e}")
        
        return {'status': 'unknown', 'error': 'Unable to retrieve health information'}
    
    def _generate_troubleshooting_tips(self, error_message: str) -> List[str]:
        """
        Generate troubleshooting tips based on error message.
        
        Args:
            error_message: Error message to analyze
            
        Returns:
            List of troubleshooting tips
        """
        tips = []
        error_lower = error_message.lower()
        
        if 'connection' in error_lower or 'network' in error_lower:
            tips.extend([
                "Check if the service is running and accessible",
                "Verify the service endpoint URL is correct",
                "Check network connectivity",
                "Ensure firewall is not blocking the connection"
            ])
        
        if 'timeout' in error_lower:
            tips.extend([
                "The service may be overloaded or slow",
                "Try increasing the timeout value",
                "Check service performance and logs"
            ])
        
        if '404' in error_message or 'not found' in error_lower:
            tips.extend([
                "Verify the endpoint path is correct",
                "Check if the API version is supported",
                "Ensure the service is properly configured"
            ])
        
        if '401' in error_message or 'unauthorized' in error_lower:
            tips.extend([
                "Check authentication credentials",
                "Verify API keys or tokens are valid",
                "Ensure proper authorization headers are set"
            ])
        
        if '500' in error_message or 'internal server error' in error_lower:
            tips.extend([
                "The service encountered an internal error",
                "Check service logs for more details",
                "Try the request again later"
            ])
        
        if not tips:
            tips.extend([
                "Check service configuration and status",
                "Verify request parameters and format",
                "Review service documentation"
            ])
        
        return tips
    
    def _show_enhanced_error_dialog(self, error_message: str):
        """
        Show enhanced error dialog with troubleshooting tips.
        
        Args:
            error_message: Error message to display
        """
        try:
            # Create custom error dialog
            error_dialog = tk.Toplevel(self)
            error_dialog.title("Request Error")
            error_dialog.geometry("500x400")
            error_dialog.transient(self)
            error_dialog.grab_set()
            
            # Error message
            error_frame = ttk.Frame(error_dialog)
            error_frame.pack(fill='x', padx=10, pady=10)
            
            ttk.Label(error_frame, text="Error Message:", font=('Segoe UI', 10, 'bold')).pack(anchor='w')
            
            error_text = tk.Text(error_frame, height=3, wrap=tk.WORD, font=('Segoe UI', 9))
            error_text.pack(fill='x', pady=(5, 0))
            error_text.insert('1.0', error_message)
            error_text.configure(state='disabled')
            
            # Troubleshooting tips
            tips_frame = ttk.Frame(error_dialog)
            tips_frame.pack(fill='both', expand=True, padx=10, pady=10)
            
            ttk.Label(tips_frame, text="Troubleshooting Tips:", font=('Segoe UI', 10, 'bold')).pack(anchor='w')
            
            tips_text = tk.Text(tips_frame, wrap=tk.WORD, font=('Segoe UI', 9))
            tips_scrollbar = ttk.Scrollbar(tips_frame, orient='vertical', command=tips_text.yview)
            tips_text.configure(yscrollcommand=tips_scrollbar.set)
            
            tips_text.pack(side='left', fill='both', expand=True, pady=(5, 0))
            tips_scrollbar.pack(side='right', fill='y', pady=(5, 0))
            
            # Add troubleshooting tips
            tips = self._generate_troubleshooting_tips(error_message)
            for i, tip in enumerate(tips, 1):
                tips_text.insert('end', f"{i}. {tip}\n\n")
            
            tips_text.configure(state='disabled')
            
            # Buttons
            button_frame = ttk.Frame(error_dialog)
            button_frame.pack(fill='x', padx=10, pady=10)
            
            ttk.Button(
                button_frame,
                text="Copy Error",
                command=lambda: self._copy_error_to_clipboard(error_message)
            ).pack(side='left', padx=(0, 5))
            
            ttk.Button(
                button_frame,
                text="Close",
                command=error_dialog.destroy
            ).pack(side='right')
            
            # Center dialog
            error_dialog.update_idletasks()
            x = (error_dialog.winfo_screenwidth() - error_dialog.winfo_width()) // 2
            y = (error_dialog.winfo_screenheight() - error_dialog.winfo_height()) // 2
            error_dialog.geometry(f"+{x}+{y}")
            
        except Exception as e:
            self.logger.error(f"Error showing enhanced error dialog: {e}")
            # Fallback to simple error dialog
            messagebox.showerror("Request Error", error_message)
    
    def _copy_error_to_clipboard(self, error_message: str):
        """Copy error message to clipboard."""
        try:
            self.clipboard_clear()
            self.clipboard_append(error_message)
            self._update_status("Error message copied to clipboard")
        except Exception as e:
            self.logger.error(f"Error copying error to clipboard: {e}")
    
    def _update_status(self, message: str):
        """
        Update the status label with a message.
        
        Args:
            message: Status message to display
        """
        if self.status_label:
            timestamp = datetime.now().strftime("%H:%M:%S")
            self.status_label.configure(text=f"{timestamp} - {message}")
    
    def refresh_service_data(self):
        """Refresh service configuration and sample endpoints."""
        self.logger.info(f"Refreshing service data for {self.service_name}")
        
        # Reload service configuration
        self._initialize_service_data()
        
        # Update header if needed
        if self.service_config and hasattr(self, 'endpoint_label'):
            self.endpoint_label.configure(text=f"Endpoint: {self.service_config.endpoint}")
        
        # Reload sample endpoints
        self._load_sample_endpoints()
        
        self._update_status("Service data refreshed")
    
    def get_service_name(self) -> str:
        """
        Get the service name this panel represents.
        
        Returns:
            Service name
        """
        return self.service_name
    
    def is_request_in_progress(self) -> bool:
        """
        Check if a request is currently in progress.
        
        Returns:
            True if request is in progress, False otherwise
        """
        return self.request_in_progress
    
    def cancel_current_request(self):
        """Cancel the current request if one is in progress."""
        if self.current_request_future and not self.current_request_future.done():
            self.current_request_future.cancel()
            self.current_request_future = None
            
            self.request_in_progress = False
            self.request_form.set_loading_state(False)
            
            self._update_status("Request cancelled")
            self.logger.info("Current request cancelled")
    
    def _add_to_request_history(self, request_data: Dict[str, Any], result: ServiceExecutionResult):
        """
        Add a request to the history.
        
        Args:
            request_data: Request information (method, endpoint, headers, body)
            result: Service execution result
        """
        try:
            # Create history entry
            history_entry = {
                'timestamp': result.execution_time,
                'method': request_data['method'],
                'endpoint': request_data['endpoint'],
                'headers': request_data.get('headers', {}),
                'body': request_data.get('body', ''),
                'status_code': result.status_code,
                'success': result.success,
                'response_time': result.response_time,
                'response_data': result.response_data,
                'error_message': result.error_message,
                'service_name': result.service_name
            }
            
            # Add to history list
            self.request_history.append(history_entry)
            
            # Limit history size
            if len(self.request_history) > self.max_history_size:
                self.request_history.pop(0)
            
            # Update history display
            self._update_history_display()
            
        except Exception as e:
            self.logger.error(f"Error adding request to history: {e}")
    
    def _update_history_display(self):
        """Update the history treeview display."""
        try:
            # Clear existing items
            for item in self.history_tree.get_children():
                self.history_tree.delete(item)
            
            # Add history entries (most recent first)
            for i, entry in enumerate(reversed(self.request_history)):
                # Format timestamp
                time_str = entry['timestamp'].strftime('%H:%M:%S')
                
                # Format status with color coding
                status_text = str(entry['status_code']) if entry['status_code'] else 'Error'
                if entry['success']:
                    status_color = 'success'
                else:
                    status_color = 'error'
                
                # Format duration
                duration_text = f"{entry['response_time']:.1f}" if entry['response_time'] else 'N/A'
                
                # Insert item
                item_id = self.history_tree.insert(
                    '',
                    'end',
                    text=str(len(self.request_history) - i),
                    values=(
                        entry['method'],
                        entry['endpoint'],
                        status_text,
                        time_str,
                        duration_text
                    )
                )
                
                # Apply color tags
                if entry['success']:
                    self.history_tree.set(item_id, 'status', f"✓ {status_text}")
                else:
                    self.history_tree.set(item_id, 'status', f"✗ {status_text}")
            
            # Update history info label
            count = len(self.request_history)
            self.history_info_label.configure(text=f"{count} request{'s' if count != 1 else ''} in history")
            
        except Exception as e:
            self.logger.error(f"Error updating history display: {e}")
    
    def _on_history_selection(self, event):
        """Handle history item selection."""
        try:
            selection = self.history_tree.selection()
            if not selection:
                self._clear_history_details()
                return
            
            # Get selected item
            item = selection[0]
            item_text = self.history_tree.item(item, 'text')
            
            # Find corresponding history entry
            history_index = len(self.request_history) - int(item_text)
            if 0 <= history_index < len(self.request_history):
                entry = self.request_history[history_index]
                self._display_history_details(entry)
            
        except Exception as e:
            self.logger.error(f"Error handling history selection: {e}")
    
    def _display_history_details(self, entry: Dict[str, Any]):
        """
        Display detailed information for a history entry.
        
        Args:
            entry: History entry dictionary
        """
        try:
            # Format details
            details = []
            details.append(f"Request: {entry['method']} {entry['endpoint']}")
            details.append(f"Time: {entry['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}")
            details.append(f"Status: {entry['status_code']} ({'Success' if entry['success'] else 'Failed'})")
            details.append(f"Response Time: {entry['response_time']:.1f}ms" if entry['response_time'] else "Response Time: N/A")
            
            if entry['error_message']:
                details.append(f"Error: {entry['error_message']}")
            
            # Headers
            if entry['headers']:
                details.append("\nRequest Headers:")
                for key, value in entry['headers'].items():
                    details.append(f"  {key}: {value}")
            
            # Request body
            if entry['body']:
                details.append(f"\nRequest Body:\n{entry['body']}")
            
            # Response data
            if entry['response_data']:
                details.append(f"\nResponse Data:\n{json.dumps(entry['response_data'], indent=2)}")
            
            # Update details display
            self.history_details_text.configure(state='normal')
            self.history_details_text.delete('1.0', tk.END)
            self.history_details_text.insert('1.0', '\n'.join(details))
            self.history_details_text.configure(state='disabled')
            
        except Exception as e:
            self.logger.error(f"Error displaying history details: {e}")
    
    def _clear_history_details(self):
        """Clear the history details display."""
        self.history_details_text.configure(state='normal')
        self.history_details_text.delete('1.0', tk.END)
        self.history_details_text.configure(state='disabled')
    
    def _clear_request_history(self):
        """Clear the request history."""
        try:
            if not self.request_history:
                return
            
            # Confirm with user
            from tkinter import messagebox
            if messagebox.askyesno("Clear History", "Are you sure you want to clear the request history?"):
                self.request_history.clear()
                self._update_history_display()
                self._clear_history_details()
                self._update_status("Request history cleared")
                
        except Exception as e:
            self.logger.error(f"Error clearing request history: {e}")
    
    def _export_request_history(self):
        """Export request history to a file."""
        try:
            if not self.request_history:
                messagebox.showinfo("Export History", "No request history to export")
                return
            
            from tkinter import filedialog
            import json
            
            # Ask user for file location
            filename = filedialog.asksaveasfilename(
                title="Export Request History",
                defaultextension=".json",
                filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
            )
            
            if filename:
                # Prepare export data
                export_data = {
                    'service_name': self.service_name,
                    'export_time': datetime.now().isoformat(),
                    'request_count': len(self.request_history),
                    'requests': []
                }
                
                for entry in self.request_history:
                    export_entry = entry.copy()
                    # Convert datetime to string for JSON serialization
                    export_entry['timestamp'] = entry['timestamp'].isoformat()
                    export_data['requests'].append(export_entry)
                
                # Write to file
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(export_data, f, indent=2, ensure_ascii=False)
                
                messagebox.showinfo("Export Complete", f"Request history exported to {filename}")
                self._update_status(f"History exported to {filename}")
                
        except Exception as e:
            self.logger.error(f"Error exporting request history: {e}")
            messagebox.showerror("Export Error", f"Failed to export history: {str(e)}")
    
    def _show_history_context_menu(self, event):
        """Show context menu for history items."""
        try:
            # Select item under cursor
            item = self.history_tree.identify_row(event.y)
            if item:
                self.history_tree.selection_set(item)
                
                # Create context menu
                context_menu = tk.Menu(self, tearoff=0)
                context_menu.add_command(label="Replay Request", command=self._replay_selected_request)
                context_menu.add_command(label="Copy Request Details", command=self._copy_selected_request)
                context_menu.add_separator()
                context_menu.add_command(label="Delete Entry", command=self._delete_selected_history_entry)
                
                # Show menu
                context_menu.tk_popup(event.x_root, event.y_root)
                
        except Exception as e:
            self.logger.error(f"Error showing history context menu: {e}")
        finally:
            if 'context_menu' in locals():
                context_menu.grab_release()
    
    def _replay_selected_request(self):
        """Replay the selected request from history."""
        try:
            selection = self.history_tree.selection()
            if not selection:
                return
            
            # Get selected history entry
            item = selection[0]
            item_text = self.history_tree.item(item, 'text')
            history_index = len(self.request_history) - int(item_text)
            
            if 0 <= history_index < len(self.request_history):
                entry = self.request_history[history_index]
                
                # Set form fields
                self.request_form.set_endpoint(entry['endpoint'])
                self.request_form.set_method(entry['method'])
                
                if entry['headers']:
                    self.request_form.set_headers(entry['headers'])
                
                if entry['body']:
                    self.request_form.set_request_body(entry['body'])
                
                # Switch to main response tab
                self.response_notebook.select(0)
                
                self._update_status(f"Loaded request from history: {entry['method']} {entry['endpoint']}")
                
        except Exception as e:
            self.logger.error(f"Error replaying request: {e}")
            messagebox.showerror("Replay Error", f"Failed to replay request: {str(e)}")
    
    def _copy_selected_request(self):
        """Copy selected request details to clipboard."""
        try:
            selection = self.history_tree.selection()
            if not selection:
                return
            
            # Get selected history entry
            item = selection[0]
            item_text = self.history_tree.item(item, 'text')
            history_index = len(self.request_history) - int(item_text)
            
            if 0 <= history_index < len(self.request_history):
                entry = self.request_history[history_index]
                
                # Format request details
                details = []
                details.append(f"Method: {entry['method']}")
                details.append(f"Endpoint: {entry['endpoint']}")
                details.append(f"Status: {entry['status_code']}")
                details.append(f"Response Time: {entry['response_time']:.1f}ms" if entry['response_time'] else "Response Time: N/A")
                
                if entry['headers']:
                    details.append("Headers:")
                    for key, value in entry['headers'].items():
                        details.append(f"  {key}: {value}")
                
                if entry['body']:
                    details.append(f"Body: {entry['body']}")
                
                if entry['response_data']:
                    details.append(f"Response: {json.dumps(entry['response_data'], indent=2)}")
                
                # Copy to clipboard
                request_text = '\n'.join(details)
                self.clipboard_clear()
                self.clipboard_append(request_text)
                
                self._update_status("Request details copied to clipboard")
                
        except Exception as e:
            self.logger.error(f"Error copying request details: {e}")
    
    def _delete_selected_history_entry(self):
        """Delete the selected history entry."""
        try:
            selection = self.history_tree.selection()
            if not selection:
                return
            
            # Confirm deletion
            if messagebox.askyesno("Delete Entry", "Are you sure you want to delete this history entry?"):
                # Get selected history entry
                item = selection[0]
                item_text = self.history_tree.item(item, 'text')
                history_index = len(self.request_history) - int(item_text)
                
                if 0 <= history_index < len(self.request_history):
                    # Remove from history
                    del self.request_history[history_index]
                    
                    # Update display
                    self._update_history_display()
                    self._clear_history_details()
                    
                    self._update_status("History entry deleted")
                    
        except Exception as e:
            self.logger.error(f"Error deleting history entry: {e}")
    
    def _copy_response_to_clipboard(self):
        """Copy the current response to clipboard."""
        try:
            response_content = self.response_viewer.get_content()
            if response_content:
                self.clipboard_clear()
                self.clipboard_append(response_content)
                self._update_status("Response copied to clipboard")
            else:
                messagebox.showinfo("Copy Response", "No response data to copy")
        except Exception as e:
            self.logger.error(f"Error copying response: {e}")
    
    def _save_response_to_file(self):
        """Save the current response to a file."""
        try:
            response_content = self.response_viewer.get_content()
            if not response_content:
                messagebox.showinfo("Save Response", "No response data to save")
                return
            
            from tkinter import filedialog
            
            # Ask user for file location
            filename = filedialog.asksaveasfilename(
                title="Save Response",
                defaultextension=".json",
                filetypes=[("JSON files", "*.json"), ("Text files", "*.txt"), ("All files", "*.*")]
            )
            
            if filename:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(response_content)
                
                messagebox.showinfo("Save Complete", f"Response saved to {filename}")
                self._update_status(f"Response saved to {filename}")
                
        except Exception as e:
            self.logger.error(f"Error saving response: {e}")
            messagebox.showerror("Save Error", f"Failed to save response: {str(e)}")
    
    def _format_response_json(self):
        """Format the current response as JSON."""
        try:
            json_data = self.response_viewer.get_json_data()
            if json_data is not None:
                self.response_viewer.display_json(json_data)
                self._update_status("Response JSON formatted")
            else:
                messagebox.showinfo("Format JSON", "No JSON data to format")
        except Exception as e:
            self.logger.error(f"Error formatting response JSON: {e}")
    
    def _setup_response_controls(self):
        """Set up response control buttons and their initial states."""
        # Initially disable response control buttons
        self.copy_response_btn.configure(state='disabled')
        self.save_response_btn.configure(state='disabled')
        self.format_response_btn.configure(state='disabled')
    
    def set_event_loop(self, event_loop: asyncio.AbstractEventLoop):
        """
        Set the asyncio event loop for async operations.
        
        Args:
            event_loop: Asyncio event loop
        """
        self.event_loop = event_loop
    
    def _create_history_tab(self):
        """Create the request history tab."""
        # Configure history tab layout
        self.history_tab_frame.columnconfigure(0, weight=1)
        self.history_tab_frame.rowconfigure(1, weight=1)
        
        # History controls frame
        self.history_controls_frame = ttk.Frame(self.history_tab_frame)
        self.history_controls_frame.grid(row=0, column=0, sticky='ew', padx=5, pady=5)
        
        # Clear history button
        self.clear_history_btn = ttk.Button(
            self.history_controls_frame,
            text="Clear History",
            command=self._clear_request_history,
            width=12
        )
        self.clear_history_btn.grid(row=0, column=0, padx=(0, 5))
        
        # Export history button
        self.export_history_btn = ttk.Button(
            self.history_controls_frame,
            text="Export History",
            command=self._export_request_history,
            width=12
        )
        self.export_history_btn.grid(row=0, column=1, padx=(0, 5))
        
        # History info label
        self.history_info_label = ttk.Label(
            self.history_controls_frame,
            text="0 requests in history",
            font=('Segoe UI', 9),
            foreground='gray'
        )
        self.history_info_label.grid(row=0, column=2, padx=(10, 0), sticky='w')
        
        # History list frame with scrollbar
        self.history_list_frame = ttk.Frame(self.history_tab_frame)
        self.history_list_frame.grid(row=1, column=0, sticky='nsew', padx=5, pady=5)
        self.history_list_frame.columnconfigure(0, weight=1)
        self.history_list_frame.rowconfigure(0, weight=1)
        
        # History treeview
        self.history_tree = ttk.Treeview(
            self.history_list_frame,
            columns=('method', 'endpoint', 'status', 'time', 'duration'),
            show='tree headings',
            height=10
        )
        
        # Configure columns
        self.history_tree.heading('#0', text='#', anchor='w')
        self.history_tree.heading('method', text='Method', anchor='w')
        self.history_tree.heading('endpoint', text='Endpoint', anchor='w')
        self.history_tree.heading('status', text='Status', anchor='center')
        self.history_tree.heading('time', text='Time', anchor='center')
        self.history_tree.heading('duration', text='Duration (ms)', anchor='center')
        
        # Configure column widths
        self.history_tree.column('#0', width=40, minwidth=30)
        self.history_tree.column('method', width=80, minwidth=60)
        self.history_tree.column('endpoint', width=200, minwidth=150)
        self.history_tree.column('status', width=80, minwidth=60)
        self.history_tree.column('time', width=120, minwidth=100)
        self.history_tree.column('duration', width=100, minwidth=80)
        
        # History scrollbar
        self.history_scrollbar = ttk.Scrollbar(
            self.history_list_frame,
            orient='vertical',
            command=self.history_tree.yview
        )
        self.history_tree.configure(yscrollcommand=self.history_scrollbar.set)
        
        # Place history widgets
        self.history_tree.grid(row=0, column=0, sticky='nsew')
        self.history_scrollbar.grid(row=0, column=1, sticky='ns')
        
        # History item details frame
        self.history_details_frame = ttk.LabelFrame(self.history_tab_frame, text="Request Details", padding=5)
        self.history_details_frame.grid(row=2, column=0, sticky='ew', padx=5, pady=(5, 0))
        self.history_details_frame.columnconfigure(0, weight=1)
        
        # Details text widget
        self.history_details_text = tk.Text(
            self.history_details_frame,
            height=6,
            wrap=tk.WORD,
            font=('Consolas', 9),
            state='disabled'
        )
        self.history_details_text.grid(row=0, column=0, sticky='ew')
        
        # Bind history selection
        self.history_tree.bind('<<TreeviewSelect>>', self._on_history_selection)
        
        # Context menu for history items
        self.history_tree.bind('<Button-3>', self._show_history_context_menu)
        
        # Clear history button
        self.clear_history_btn = ttk.Button(
            self.history_controls_frame,
            text="Clear History",
            command=self._clear_request_history
        )
        self.clear_history_btn.grid(row=0, column=0, padx=(0, 5))
        
        # Export history button
        self.export_history_btn = ttk.Button(
            self.history_controls_frame,
            text="Export History",
            command=self._export_request_history
        )
        self.export_history_btn.grid(row=0, column=1, padx=(0, 5))
        
        # History list frame
        self.history_list_frame = ttk.Frame(self.history_tab_frame)
        self.history_list_frame.grid(row=1, column=0, sticky='nsew', padx=5, pady=5)
        self.history_list_frame.columnconfigure(0, weight=1)
        self.history_list_frame.rowconfigure(0, weight=1)
        
        # History treeview
        self.history_tree = ttk.Treeview(
            self.history_list_frame,
            columns=('method', 'endpoint', 'status', 'time', 'response_time'),
            show='tree headings'
        )
        
        # Configure columns
        self.history_tree.heading('#0', text='Timestamp')
        self.history_tree.heading('method', text='Method')
        self.history_tree.heading('endpoint', text='Endpoint')
        self.history_tree.heading('status', text='Status')
        self.history_tree.heading('time', text='Duration')
        self.history_tree.heading('response_time', text='Response Time')
        
        # Column widths
        self.history_tree.column('#0', width=120)
        self.history_tree.column('method', width=60)
        self.history_tree.column('endpoint', width=200)
        self.history_tree.column('status', width=60)
        self.history_tree.column('time', width=80)
        self.history_tree.column('response_time', width=100)
        
        # History scrollbar
        self.history_scrollbar = ttk.Scrollbar(
            self.history_list_frame,
            orient=tk.VERTICAL,
            command=self.history_tree.yview
        )
        self.history_tree.configure(yscrollcommand=self.history_scrollbar.set)
        
        # Place history components
        self.history_tree.grid(row=0, column=0, sticky='nsew')
        self.history_scrollbar.grid(row=0, column=1, sticky='ns')
        
        # Configure history tab layout
        self.history_tab_frame.columnconfigure(0, weight=1)
        self.history_tab_frame.rowconfigure(1, weight=1)
        
        # Bind double-click to load history item
        self.history_tree.bind('<Double-1>', self._on_history_item_double_click)
    
    def _setup_response_controls(self):
        """Set up response control button states and bindings."""
        # Initially disable some buttons
        self.copy_response_btn.configure(state='disabled')
        self.save_response_btn.configure(state='disabled')
        self.format_response_btn.configure(state='disabled')
    
    def _add_to_request_history(self, request_data: Dict[str, Any], result: 'ServiceExecutionResult'):
        """
        Add a request to the history.
        
        Args:
            request_data: Request information
            result: Service execution result
        """
        try:
            history_item = {
                'timestamp': datetime.now(),
                'service_name': self.service_name,
                'method': request_data.get('method', 'GET'),
                'endpoint': request_data.get('endpoint', ''),
                'headers': request_data.get('headers', {}),
                'body': request_data.get('body', ''),
                'status_code': result.status_code,
                'success': result.success,
                'response_time': result.response_time,
                'response_data': result.response_data,
                'error_message': result.error_message,
                'execution_time': result.execution_time
            }
            
            # Add to history
            self.request_history.append(history_item)
            
            # Limit history size
            if len(self.request_history) > self.max_history_size:
                self.request_history.pop(0)
            
            # Update history display
            self._update_history_display()
            
        except Exception as e:
            self.logger.error(f"Error adding to request history: {e}")
    
    def _update_history_display(self):
        """Update the history tree view with current history."""
        try:
            # Clear existing items
            for item in self.history_tree.get_children():
                self.history_tree.delete(item)
            
            # Add history items (most recent first)
            for i, item in enumerate(reversed(self.request_history)):
                timestamp_str = item['timestamp'].strftime('%H:%M:%S')
                status_text = str(item['status_code']) if item['success'] else 'Error'
                response_time_text = f"{item['response_time']:.1f}ms" if item['response_time'] else 'N/A'
                
                # Insert item
                tree_item = self.history_tree.insert(
                    '',
                    'end',
                    text=timestamp_str,
                    values=(
                        item['method'],
                        item['endpoint'][:30] + '...' if len(item['endpoint']) > 30 else item['endpoint'],
                        status_text,
                        f"{item['response_time']:.0f}ms" if item['response_time'] else 'N/A',
                        response_time_text
                    )
                )
                
                # Color code based on success
                if item['success']:
                    self.history_tree.set(tree_item, 'status', f"✓ {status_text}")
                else:
                    self.history_tree.set(tree_item, 'status', f"✗ {status_text}")
            
        except Exception as e:
            self.logger.error(f"Error updating history display: {e}")
    
    def _on_history_item_double_click(self, event):
        """Handle double-click on history item to load it."""
        try:
            selection = self.history_tree.selection()
            if not selection:
                return
            
            # Get selected item index (reversed because we display most recent first)
            item_index = len(self.request_history) - 1 - self.history_tree.index(selection[0])
            
            if 0 <= item_index < len(self.request_history):
                history_item = self.request_history[item_index]
                
                # Load request data into form
                self.request_form.set_endpoint(history_item['endpoint'])
                self.request_form.set_method(history_item['method'])
                
                if history_item['headers']:
                    self.request_form.set_headers(history_item['headers'])
                
                if history_item['body']:
                    self.request_form.set_request_body(history_item['body'])
                
                # Switch to response tab and show the response
                response_data = {
                    'status_code': history_item['status_code'],
                    'success': history_item['success'],
                    'response_time_ms': history_item['response_time'],
                    'execution_time': history_item['execution_time'].isoformat(),
                    'response_data': history_item['response_data']
                }
                
                if history_item['error_message']:
                    response_data['error_message'] = history_item['error_message']
                
                self.response_viewer.set_json(response_data)
                self.response_notebook.select(0)  # Switch to response tab
                
                self._update_status(f"Loaded request from history: {history_item['method']} {history_item['endpoint']}")
                
        except Exception as e:
            self.logger.error(f"Error loading history item: {e}")
    
    def _clear_request_history(self):
        """Clear the request history."""
        try:
            from tkinter import messagebox
            
            if not self.request_history:
                messagebox.showinfo("History", "Request history is already empty")
                return
            
            result = messagebox.askyesno(
                "Clear History",
                f"Are you sure you want to clear {len(self.request_history)} history items?"
            )
            
            if result:
                self.request_history.clear()
                self._update_history_display()
                self._update_status("Request history cleared")
                
        except Exception as e:
            self.logger.error(f"Error clearing request history: {e}")
    
    def _export_request_history(self):
        """Export request history to a file."""
        try:
            from tkinter import filedialog
            import json
            
            if not self.request_history:
                messagebox.showinfo("Export History", "No request history to export")
                return
            
            # Ask user for file location
            filename = filedialog.asksaveasfilename(
                title="Export Request History",
                defaultextension=".json",
                filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
            )
            
            if filename:
                # Prepare export data
                export_data = {
                    'service_name': self.service_name,
                    'export_timestamp': datetime.now().isoformat(),
                    'total_requests': len(self.request_history),
                    'requests': []
                }
                
                for item in self.request_history:
                    export_item = {
                        'timestamp': item['timestamp'].isoformat(),
                        'method': item['method'],
                        'endpoint': item['endpoint'],
                        'headers': item['headers'],
                        'body': item['body'],
                        'status_code': item['status_code'],
                        'success': item['success'],
                        'response_time_ms': item['response_time'],
                        'response_data': item['response_data'],
                        'error_message': item['error_message'],
                        'execution_time': item['execution_time'].isoformat()
                    }
                    export_data['requests'].append(export_item)
                
                # Write to file
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(export_data, f, indent=2, ensure_ascii=False)
                
                messagebox.showinfo("Export Complete", f"Request history exported to {filename}")
                self._update_status(f"Exported {len(self.request_history)} requests to {filename}")
                
        except Exception as e:
            self.logger.error(f"Error exporting request history: {e}")
            messagebox.showerror("Export Error", f"Failed to export history: {str(e)}")
    
    def _copy_response_to_clipboard(self):
        """Copy the current response to clipboard."""
        try:
            response_text = self.response_viewer.get_text()
            if response_text:
                self.clipboard_clear()
                self.clipboard_append(response_text)
                self._update_status("Response copied to clipboard")
            else:
                messagebox.showinfo("Copy Response", "No response data to copy")
                
        except Exception as e:
            self.logger.error(f"Error copying response to clipboard: {e}")
            messagebox.showerror("Copy Error", f"Failed to copy response: {str(e)}")
    
    def _save_response_to_file(self):
        """Save the current response to a file."""
        try:
            from tkinter import filedialog
            
            response_text = self.response_viewer.get_text()
            if not response_text:
                messagebox.showinfo("Save Response", "No response data to save")
                return
            
            # Ask user for file location
            filename = filedialog.asksaveasfilename(
                title="Save Response",
                defaultextension=".json",
                filetypes=[("JSON files", "*.json"), ("Text files", "*.txt"), ("All files", "*.*")]
            )
            
            if filename:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(response_text)
                
                messagebox.showinfo("Save Complete", f"Response saved to {filename}")
                self._update_status(f"Response saved to {filename}")
                
        except Exception as e:
            self.logger.error(f"Error saving response to file: {e}")
            messagebox.showerror("Save Error", f"Failed to save response: {str(e)}")
    
    def _format_response_json(self):
        """Format the response JSON for better readability."""
        try:
            current_json = self.response_viewer.get_json()
            if current_json:
                self.response_viewer.set_json(current_json)
                self._update_status("Response JSON formatted")
            else:
                messagebox.showinfo("Format JSON", "No JSON response data to format")
                
        except Exception as e:
            self.logger.error(f"Error formatting response JSON: {e}")
            messagebox.showerror("Format Error", f"Failed to format JSON: {str(e)}")
    
    def destroy(self):
        """Clean up resources when destroying the widget."""
        # Cancel any pending requests
        self.cancel_current_request()
        
        # Call parent destroy
        super().destroy()