"""
Request form component for endpoint input and HTTP request controls.
Provides input fields, method selection, and request execution controls.
"""
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Dict, List, Optional, Callable, Any
import json
import re


class RequestForm(ttk.Frame):
    """
    Request form component for HTTP request configuration and execution.
    
    Provides input fields for endpoint, HTTP method selection, request body,
    headers, and controls for executing requests with validation.
    """
    
    # Supported HTTP methods
    HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
    
    def __init__(
        self,
        parent,
        on_send_request: Optional[Callable[[str, str, Dict[str, str], Optional[str]], None]] = None,
        default_method: str = 'GET',
        show_headers: bool = True,
        show_body: bool = True,
        **kwargs
    ):
        """
        Initialize request form.
        
        Args:
            parent: Parent widget
            on_send_request: Callback function for sending requests
            default_method: Default HTTP method
            show_headers: Whether to show headers section
            show_body: Whether to show request body section
            **kwargs: Additional arguments for ttk.Frame
        """
        super().__init__(parent, **kwargs)
        
        self.on_send_request = on_send_request
        self.default_method = default_method
        self.show_headers = show_headers
        self.show_body = show_body
        
        # Form state
        self._is_loading = False
        self._endpoint_history: List[str] = []
        
        # Create UI elements
        self._create_widgets()
        self._setup_layout()
        self._setup_bindings()
        self._setup_validation()
        
        # Set initial values
        self.method_var.set(default_method)
        self._on_method_change()
    
    def _create_widgets(self):
        """Create the UI widgets for the request form."""
        # Main container
        self.main_frame = ttk.Frame(self)
        
        # Endpoint section
        self.endpoint_frame = ttk.LabelFrame(self.main_frame, text="Endpoint", padding=10)
        
        # Method selection
        self.method_label = ttk.Label(self.endpoint_frame, text="Method:")
        self.method_var = tk.StringVar()
        self.method_combo = ttk.Combobox(
            self.endpoint_frame,
            textvariable=self.method_var,
            values=self.HTTP_METHODS,
            state='readonly',
            width=8
        )
        
        # Endpoint URL input
        self.endpoint_label = ttk.Label(self.endpoint_frame, text="URL:")
        self.endpoint_var = tk.StringVar()
        self.endpoint_entry = ttk.Entry(
            self.endpoint_frame,
            textvariable=self.endpoint_var,
            font=('Consolas', 10),
            width=50
        )
        
        # Send button
        self.send_button = ttk.Button(
            self.endpoint_frame,
            text="Send Request",
            command=self._send_request,
            style='Accent.TButton'
        )
        
        # Headers section (optional)
        if self.show_headers:
            self.headers_frame = ttk.LabelFrame(self.main_frame, text="Headers", padding=10)
            
            # Headers text widget with scrollbar
            self.headers_text_frame = ttk.Frame(self.headers_frame)
            self.headers_text = tk.Text(
                self.headers_text_frame,
                height=4,
                width=60,
                font=('Consolas', 9),
                wrap=tk.NONE
            )
            self.headers_scrollbar = ttk.Scrollbar(
                self.headers_text_frame,
                orient=tk.VERTICAL,
                command=self.headers_text.yview
            )
            self.headers_text.configure(yscrollcommand=self.headers_scrollbar.set)
            
            # Headers help label
            self.headers_help = ttk.Label(
                self.headers_frame,
                text="Enter headers as key: value pairs, one per line",
                font=('Segoe UI', 8),
                foreground='gray'
            )
            
            # Common headers buttons
            self.headers_buttons_frame = ttk.Frame(self.headers_frame)
            self.add_content_type_btn = ttk.Button(
                self.headers_buttons_frame,
                text="+ JSON Content-Type",
                command=lambda: self._add_header("Content-Type", "application/json"),
                width=18
            )
            self.add_auth_btn = ttk.Button(
                self.headers_buttons_frame,
                text="+ Authorization",
                command=lambda: self._add_header("Authorization", "Bearer "),
                width=15
            )
        
        # Request body section (optional)
        if self.show_body:
            self.body_frame = ttk.LabelFrame(self.main_frame, text="Request Body", padding=10)
            
            # Body format selection
            self.body_format_frame = ttk.Frame(self.body_frame)
            self.body_format_label = ttk.Label(self.body_format_frame, text="Format:")
            self.body_format_var = tk.StringVar(value="JSON")
            self.body_format_combo = ttk.Combobox(
                self.body_format_frame,
                textvariable=self.body_format_var,
                values=["JSON", "Text", "Form Data"],
                state='readonly',
                width=10
            )
            
            # Format/Validate buttons
            self.format_json_btn = ttk.Button(
                self.body_format_frame,
                text="Format JSON",
                command=self._format_json_body,
                width=12
            )
            self.validate_json_btn = ttk.Button(
                self.body_format_frame,
                text="Validate",
                command=self._validate_json_body,
                width=10
            )
            
            # Body text widget with scrollbar
            self.body_text_frame = ttk.Frame(self.body_frame)
            self.body_text = tk.Text(
                self.body_text_frame,
                height=8,
                width=60,
                font=('Consolas', 9),
                wrap=tk.NONE
            )
            self.body_scrollbar_v = ttk.Scrollbar(
                self.body_text_frame,
                orient=tk.VERTICAL,
                command=self.body_text.yview
            )
            self.body_scrollbar_h = ttk.Scrollbar(
                self.body_text_frame,
                orient=tk.HORIZONTAL,
                command=self.body_text.xview
            )
            self.body_text.configure(
                yscrollcommand=self.body_scrollbar_v.set,
                xscrollcommand=self.body_scrollbar_h.set
            )
        
        # Status/Loading indicator
        self.status_frame = ttk.Frame(self.main_frame)
        self.status_label = ttk.Label(
            self.status_frame,
            text="Ready",
            font=('Segoe UI', 9),
            foreground='green'
        )
        
        # Progress bar (hidden by default)
        self.progress_bar = ttk.Progressbar(
            self.status_frame,
            mode='indeterminate',
            length=200
        )
    
    def _setup_layout(self):
        """Set up the layout of widgets."""
        # Configure grid weights
        self.columnconfigure(0, weight=1)
        self.rowconfigure(0, weight=1)
        
        self.main_frame.columnconfigure(0, weight=1)
        
        # Place main frame
        self.main_frame.grid(row=0, column=0, sticky='nsew', padx=10, pady=10)
        
        # Place endpoint frame
        self.endpoint_frame.grid(row=0, column=0, sticky='ew', pady=(0, 10))
        self.endpoint_frame.columnconfigure(2, weight=1)
        
        # Layout endpoint widgets
        self.method_label.grid(row=0, column=0, sticky='w', padx=(0, 5))
        self.method_combo.grid(row=0, column=1, sticky='w', padx=(0, 15))
        self.endpoint_label.grid(row=0, column=2, sticky='w', padx=(0, 5))
        self.endpoint_entry.grid(row=0, column=3, sticky='ew', padx=(0, 10))
        self.send_button.grid(row=0, column=4, sticky='e')
        
        row = 1
        
        # Place headers frame
        if self.show_headers:
            self.headers_frame.grid(row=row, column=0, sticky='ew', pady=(0, 10))
            self.headers_frame.columnconfigure(0, weight=1)
            
            # Headers help
            self.headers_help.grid(row=0, column=0, sticky='w', pady=(0, 5))
            
            # Headers buttons
            self.headers_buttons_frame.grid(row=1, column=0, sticky='w', pady=(0, 5))
            self.add_content_type_btn.grid(row=0, column=0, padx=(0, 5))
            self.add_auth_btn.grid(row=0, column=1, padx=(0, 5))
            
            # Headers text area
            self.headers_text_frame.grid(row=2, column=0, sticky='ew')
            self.headers_text_frame.columnconfigure(0, weight=1)
            
            self.headers_text.grid(row=0, column=0, sticky='ew')
            self.headers_scrollbar.grid(row=0, column=1, sticky='ns')
            
            row += 1
        
        # Place body frame
        if self.show_body:
            self.body_frame.grid(row=row, column=0, sticky='ew', pady=(0, 10))
            self.body_frame.columnconfigure(0, weight=1)
            
            # Body format controls
            self.body_format_frame.grid(row=0, column=0, sticky='w', pady=(0, 5))
            self.body_format_label.grid(row=0, column=0, padx=(0, 5))
            self.body_format_combo.grid(row=0, column=1, padx=(0, 15))
            self.format_json_btn.grid(row=0, column=2, padx=(0, 5))
            self.validate_json_btn.grid(row=0, column=3, padx=(0, 5))
            
            # Body text area
            self.body_text_frame.grid(row=1, column=0, sticky='ew')
            self.body_text_frame.columnconfigure(0, weight=1)
            self.body_text_frame.rowconfigure(0, weight=1)
            
            self.body_text.grid(row=0, column=0, sticky='ew')
            self.body_scrollbar_v.grid(row=0, column=1, sticky='ns')
            self.body_scrollbar_h.grid(row=1, column=0, sticky='ew')
            
            row += 1
        
        # Place status frame
        self.status_frame.grid(row=row, column=0, sticky='ew')
        self.status_label.grid(row=0, column=0, sticky='w')
    
    def _setup_bindings(self):
        """Set up event bindings."""
        # Method change handler
        self.method_combo.bind('<<ComboboxSelected>>', lambda e: self._on_method_change())
        
        # Enter key in endpoint field sends request
        self.endpoint_entry.bind('<Return>', lambda e: self._send_request())
        
        # Body format change handler
        if self.show_body:
            self.body_format_combo.bind('<<ComboboxSelected>>', lambda e: self._on_body_format_change())
        
        # Endpoint validation
        self.endpoint_var.trace('w', self._validate_endpoint)
    
    def _setup_validation(self):
        """Set up form validation."""
        # Endpoint validation regex
        self.url_pattern = re.compile(r'^(/[^?\s]*)?(\?[^#\s]*)?(#[^\s]*)?$')
    
    def _on_method_change(self):
        """Handle HTTP method change."""
        method = self.method_var.get()
        
        # Enable/disable body section based on method
        if self.show_body:
            if method in ['POST', 'PUT', 'PATCH']:
                self._enable_body_section(True)
            else:
                self._enable_body_section(False)
        
        # Update send button text
        self.send_button.configure(text=f"Send {method}")
    
    def _on_body_format_change(self):
        """Handle body format change."""
        format_type = self.body_format_var.get()
        
        if format_type == "JSON":
            self.format_json_btn.configure(state='normal')
            self.validate_json_btn.configure(state='normal')
        else:
            self.format_json_btn.configure(state='disabled')
            self.validate_json_btn.configure(state='disabled')
    
    def _enable_body_section(self, enabled: bool):
        """Enable or disable the body section."""
        if not self.show_body:
            return
        
        state = 'normal' if enabled else 'disabled'
        self.body_text.configure(state=state)
        self.body_format_combo.configure(state='readonly' if enabled else 'disabled')
        
        if enabled:
            self._on_body_format_change()
        else:
            self.format_json_btn.configure(state='disabled')
            self.validate_json_btn.configure(state='disabled')
    
    def _validate_endpoint(self, *args):
        """Validate endpoint URL format."""
        endpoint = self.endpoint_var.get()
        
        if not endpoint:
            self._set_status("Enter an endpoint URL", 'orange')
            return False
        
        if not endpoint.startswith('/'):
            self._set_status("Endpoint should start with /", 'red')
            return False
        
        if not self.url_pattern.match(endpoint):
            self._set_status("Invalid endpoint format", 'red')
            return False
        
        self._set_status("Ready", 'green')
        return True
    
    def _add_header(self, key: str, value: str):
        """Add a header to the headers text area."""
        if not self.show_headers:
            return
        
        current_text = self.headers_text.get('1.0', tk.END).strip()
        new_header = f"{key}: {value}"
        
        if current_text:
            self.headers_text.insert(tk.END, f"\n{new_header}")
        else:
            self.headers_text.insert('1.0', new_header)
        
        # Position cursor at end of value for easy editing
        self.headers_text.mark_set(tk.INSERT, f"end-{len(value)}c")
        self.headers_text.focus()
    
    def _format_json_body(self):
        """Format JSON in the body text area."""
        if not self.show_body:
            return
        
        try:
            content = self.body_text.get('1.0', tk.END).strip()
            if not content:
                return
            
            # Parse and reformat JSON
            parsed = json.loads(content)
            formatted = json.dumps(parsed, indent=2, ensure_ascii=False)
            
            # Replace content
            self.body_text.delete('1.0', tk.END)
            self.body_text.insert('1.0', formatted)
            
            self._set_status("JSON formatted successfully", 'green')
            
        except json.JSONDecodeError as e:
            messagebox.showerror("JSON Error", f"Invalid JSON: {str(e)}")
            self._set_status("Invalid JSON format", 'red')
    
    def _validate_json_body(self):
        """Validate JSON in the body text area."""
        if not self.show_body:
            return
        
        try:
            content = self.body_text.get('1.0', tk.END).strip()
            if not content:
                self._set_status("Body is empty", 'orange')
                return
            
            json.loads(content)
            self._set_status("JSON is valid", 'green')
            messagebox.showinfo("Validation", "JSON is valid!")
            
        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON: {str(e)}"
            self._set_status("Invalid JSON format", 'red')
            messagebox.showerror("JSON Error", error_msg)
    
    def _parse_headers(self) -> Dict[str, str]:
        """Parse headers from the headers text area."""
        headers = {}
        
        if not self.show_headers:
            return headers
        
        content = self.headers_text.get('1.0', tk.END).strip()
        if not content:
            return headers
        
        for line in content.split('\n'):
            line = line.strip()
            if not line or ':' not in line:
                continue
            
            key, value = line.split(':', 1)
            headers[key.strip()] = value.strip()
        
        return headers
    
    def _get_request_body(self) -> Optional[str]:
        """Get request body content."""
        if not self.show_body:
            return None
        
        method = self.method_var.get()
        if method not in ['POST', 'PUT', 'PATCH']:
            return None
        
        content = self.body_text.get('1.0', tk.END).strip()
        return content if content else None
    
    def _send_request(self):
        """Send the HTTP request."""
        if self._is_loading:
            return
        
        # Validate form
        if not self._validate_endpoint():
            return
        
        endpoint = self.endpoint_var.get().strip()
        method = self.method_var.get()
        headers = self._parse_headers()
        body = self._get_request_body()
        
        # Validate JSON body if present
        if body and self.show_body and self.body_format_var.get() == "JSON":
            try:
                json.loads(body)
            except json.JSONDecodeError as e:
                messagebox.showerror("JSON Error", f"Invalid JSON in request body: {str(e)}")
                return
        
        # Add endpoint to history
        if endpoint not in self._endpoint_history:
            self._endpoint_history.append(endpoint)
            if len(self._endpoint_history) > 10:  # Keep last 10
                self._endpoint_history.pop(0)
        
        # Set loading state
        self._set_loading(True)
        
        # Call the callback
        if self.on_send_request:
            try:
                self.on_send_request(endpoint, method, headers, body)
            except Exception as e:
                self._set_loading(False)
                messagebox.showerror("Request Error", f"Error sending request: {str(e)}")
    
    def _set_loading(self, loading: bool):
        """Set the loading state of the form."""
        self._is_loading = loading
        
        if loading:
            self.send_button.configure(state='disabled', text="Sending...")
            self.progress_bar.grid(row=0, column=1, padx=(10, 0))
            self.progress_bar.start()
            self._set_status("Sending request...", 'blue')
        else:
            self.send_button.configure(state='normal')
            self.send_button.configure(text=f"Send {self.method_var.get()}")
            self.progress_bar.stop()
            self.progress_bar.grid_remove()
            self._set_status("Ready", 'green')
    
    def _set_status(self, message: str, color: str = 'black'):
        """Set status message with color."""
        self.status_label.configure(text=message, foreground=color)
    
    def set_endpoint(self, endpoint: str):
        """Set the endpoint URL."""
        self.endpoint_var.set(endpoint)
    
    def set_method(self, method: str):
        """Set the HTTP method."""
        if method in self.HTTP_METHODS:
            self.method_var.set(method)
            self._on_method_change()
    
    def set_headers(self, headers: Dict[str, str]):
        """Set request headers."""
        if not self.show_headers:
            return
        
        header_lines = [f"{key}: {value}" for key, value in headers.items()]
        self.headers_text.delete('1.0', tk.END)
        self.headers_text.insert('1.0', '\n'.join(header_lines))
    
    def set_body(self, body: str, format_type: str = "JSON"):
        """Set request body content."""
        if not self.show_body:
            return
        
        self.body_format_var.set(format_type)
        self.body_text.delete('1.0', tk.END)
        self.body_text.insert('1.0', body)
        self._on_body_format_change()
    
    def clear_form(self):
        """Clear all form fields."""
        self.endpoint_var.set("")
        self.method_var.set(self.default_method)
        
        if self.show_headers:
            self.headers_text.delete('1.0', tk.END)
        
        if self.show_body:
            self.body_text.delete('1.0', tk.END)
            self.body_format_var.set("JSON")
        
        self._on_method_change()
        self._set_status("Ready", 'green')
    
    def get_endpoint_history(self) -> List[str]:
        """Get the endpoint history."""
        return self._endpoint_history.copy()
    
    def set_request_callback(self, callback: Callable[[str, str, Dict[str, str], Optional[str]], None]):
        """Set the request callback function."""
        self.on_send_request = callback
    
    def request_completed(self):
        """Call this when the request is completed to reset loading state."""
        self._set_loading(False)
    
    def set_loading_state(self, loading: bool):
        """Set the loading state of the form."""
        self._set_loading(loading)
    
    def set_request_body(self, body: str):
        """Set the request body content."""
        self.set_body(body)
    
    def clear_request_body(self):
        """Clear the request body."""
        if self.show_body:
            self.body_text.delete('1.0', tk.END)