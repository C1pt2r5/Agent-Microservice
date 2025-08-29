"""
Main application window for the MCP Dashboard GUI.
Provides the primary interface with sidebar navigation, main panel layout, and health status footer.
"""
import tkinter as tk
from tkinter import ttk, messagebox
import asyncio
import logging
from typing import Optional, Dict, List, Callable, Any
from datetime import datetime

from services.service_manager import ServiceManager, ServiceExecutionResult
from services.health_checker import ServiceHealthInfo, HealthStatus
from config.service_config import ServiceConfig
from .components.status_indicator import StatusIndicator
from .components.status_bar import StatusBar, StatusType
from .service_panel import ServicePanel
from utils.error_handler import get_error_handler, handle_error
from utils.logger import get_logger

# Import Agentic Services Panel
try:
    from .components.agentic_services_panel import AgenticServicesPanel
    AGENTIC_SERVICES_AVAILABLE = True
except ImportError:
    AGENTIC_SERVICES_AVAILABLE = False
    print("Warning: Agentic Services Panel not available")


class MainWindow:
    """
    Main application window using Tkinter.
    
    Manages overall layout, component coordination, application lifecycle,
    and provides sidebar navigation with main panel for endpoint testing.
    """
    
    def __init__(self, service_manager: ServiceManager, event_loop: Optional[asyncio.AbstractEventLoop] = None):
        """
        Initialize main window with service manager.
        
        Args:
            service_manager: Service manager instance for business logic
            event_loop: Optional asyncio event loop for async operations
        """
        self.service_manager = service_manager
        self.event_loop = event_loop
        self.logger = logging.getLogger("MainWindow")
        
        # Window and UI state
        self.root: Optional[tk.Tk] = None
        self.selected_service: Optional[str] = None
        
        # UI components
        self.sidebar_frame: Optional[ttk.Frame] = None
        self.main_panel_frame: Optional[ttk.Frame] = None
        self.footer_frame: Optional[ttk.Frame] = None
        
        # Service navigation
        self.service_buttons: Dict[str, ttk.Button] = {}
        self.service_status_indicators: Dict[str, StatusIndicator] = {}
        
        # Main panel components
        self.service_info_label: Optional[ttk.Label] = None
        self.endpoint_frame: Optional[ttk.Frame] = None
        self.response_frame: Optional[ttk.Frame] = None
        
        # Current service panel (will be created dynamically)
        self.current_service_panel: Optional[tk.Widget] = None

        # Agentic Services panel
        self.agentic_services_panel: Optional[AgenticServicesPanel] = None

        # Status and health monitoring
        self.status_bar: Optional[StatusBar] = None
        self.health_status_frame: Optional[ttk.Frame] = None

        # Error handling
        self.error_handler = None
        
        # Window configuration
        self.min_width = 900
        self.min_height = 600
        self.default_width = 1200
        self.default_height = 800
    
    def create_window(self) -> tk.Tk:
        """
        Create and configure the main application window.
        
        Returns:
            Configured Tk root window
        """
        self.root = tk.Tk()
        self.root.title("MCP Dashboard - Service Testing Interface")
        
        # Set window size and position
        self._configure_window()
        
        # Set up the main layout
        self._setup_main_layout()
        
        # Create UI components
        self._create_sidebar()
        self._create_main_panel()
        self._create_footer()
        
        # Set up event bindings
        self._setup_event_bindings()
        
        # Initialize error handling
        self._setup_error_handling()
        
        # Initialize with service data
        self._initialize_services()
        
        # Set up health monitoring callbacks
        self._setup_health_monitoring()
        
        # Start periodic UI updates for health status
        self._start_health_ui_updates()
        
        self.logger.info("Main window created and initialized")
        return self.root
    
    def _configure_window(self):
        """Configure window properties, size, and positioning."""
        # Set minimum size
        self.root.minsize(self.min_width, self.min_height)
        
        # Set default size
        self.root.geometry(f"{self.default_width}x{self.default_height}")
        
        # Center window on screen
        self.root.update_idletasks()
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        
        x = (screen_width - self.default_width) // 2
        y = (screen_height - self.default_height) // 2
        
        self.root.geometry(f"{self.default_width}x{self.default_height}+{x}+{y}")
        
        # Configure window icon (if available)
        try:
            # This would set an icon if we had one
            # self.root.iconbitmap("icon.ico")
            pass
        except Exception:
            pass
        
        # Configure window closing behavior
        self.root.protocol("WM_DELETE_WINDOW", self._on_window_closing)
    
    def _setup_main_layout(self):
        """Set up the main layout structure with sidebar, main panel, and footer."""
        # Configure root grid weights for responsive layout
        self.root.columnconfigure(1, weight=1)  # Main panel expands
        self.root.rowconfigure(0, weight=1)     # Content area expands
        
        # Create main frames
        self.sidebar_frame = ttk.Frame(self.root, width=250, relief='solid', borderwidth=1)
        self.main_panel_frame = ttk.Frame(self.root, relief='solid', borderwidth=1)
        self.footer_frame = ttk.Frame(self.root, height=60, relief='solid', borderwidth=1)
        
        # Place frames in grid
        self.sidebar_frame.grid(row=0, column=0, sticky='nsew', padx=(5, 2), pady=(5, 2))
        self.main_panel_frame.grid(row=0, column=1, sticky='nsew', padx=(2, 5), pady=(5, 2))
        self.footer_frame.grid(row=1, column=0, columnspan=2, sticky='ew', padx=5, pady=(2, 5))
        
        # Prevent frames from shrinking
        self.sidebar_frame.grid_propagate(False)
        self.footer_frame.grid_propagate(False)
        
        # Configure internal grid weights
        self.sidebar_frame.rowconfigure(1, weight=1)  # Service list expands
        self.main_panel_frame.columnconfigure(0, weight=1)
        self.main_panel_frame.rowconfigure(1, weight=1)  # Main content expands
        self.footer_frame.columnconfigure(1, weight=1)   # Status bar expands
    
    def _create_sidebar(self):
        """Create sidebar with service navigation."""
        # Sidebar title
        title_label = ttk.Label(
            self.sidebar_frame,
            text="Services",
            font=('Segoe UI', 12, 'bold')
        )
        title_label.grid(row=0, column=0, sticky='w', padx=10, pady=(10, 5))
        
        # Service list frame with scrollbar
        self.service_list_frame = ttk.Frame(self.sidebar_frame)
        self.service_list_frame.grid(row=1, column=0, sticky='nsew', padx=5, pady=5)
        self.service_list_frame.columnconfigure(0, weight=1)
        
        # Create scrollable area for services
        self.service_canvas = tk.Canvas(self.service_list_frame, highlightthickness=0)
        self.service_scrollbar = ttk.Scrollbar(
            self.service_list_frame,
            orient="vertical",
            command=self.service_canvas.yview
        )
        self.service_scrollable_frame = ttk.Frame(self.service_canvas)
        
        # Configure scrolling
        self.service_scrollable_frame.bind(
            "<Configure>",
            lambda e: self.service_canvas.configure(scrollregion=self.service_canvas.bbox("all"))
        )
        
        self.service_canvas.create_window((0, 0), window=self.service_scrollable_frame, anchor="nw")
        self.service_canvas.configure(yscrollcommand=self.service_scrollbar.set)
        
        # Place scrollable components
        self.service_canvas.grid(row=0, column=0, sticky='nsew')
        self.service_scrollbar.grid(row=0, column=1, sticky='ns')
        
        self.service_list_frame.rowconfigure(0, weight=1)
        self.service_list_frame.columnconfigure(0, weight=1)
        
        # Bind mouse wheel to canvas
        self.service_canvas.bind("<MouseWheel>", self._on_mousewheel)
        
        # Refresh button
        refresh_button = ttk.Button(
            self.sidebar_frame,
            text="Refresh Services",
            command=self._refresh_services
        )
        refresh_button.grid(row=2, column=0, sticky='ew', padx=10, pady=(5, 10))
    
    def _create_main_panel(self):
        """Create main panel layout for endpoint testing."""
        # Main panel title area
        self.title_frame = ttk.Frame(self.main_panel_frame)
        self.title_frame.grid(row=0, column=0, sticky='ew', padx=10, pady=(10, 5))
        self.title_frame.columnconfigure(0, weight=1)
        
        # Service info label
        self.service_info_label = ttk.Label(
            self.title_frame,
            text="Select a service from the sidebar to begin testing",
            font=('Segoe UI', 11),
            foreground='gray'
        )
        self.service_info_label.grid(row=0, column=0, sticky='w')
        
        # Main content area (will contain service-specific panels)
        self.content_frame = ttk.Frame(self.main_panel_frame)
        self.content_frame.grid(row=1, column=0, sticky='nsew', padx=10, pady=5)
        self.content_frame.columnconfigure(0, weight=1)
        self.content_frame.rowconfigure(0, weight=1)
        
        # Default content when no service is selected
        self._create_default_content()
    
    def _create_default_content(self):
        """Create default content shown when no service is selected."""
        self.default_content = ttk.Frame(self.content_frame)
        self.default_content.grid(row=0, column=0, sticky='nsew')
        self.default_content.columnconfigure(0, weight=1)
        self.default_content.rowconfigure(0, weight=1)
        
        # Welcome message
        welcome_frame = ttk.Frame(self.default_content)
        welcome_frame.place(relx=0.5, rely=0.5, anchor='center')
        
        welcome_label = ttk.Label(
            welcome_frame,
            text="MCP Dashboard",
            font=('Segoe UI', 18, 'bold')
        )
        welcome_label.pack(pady=(0, 10))
        
        instruction_label = ttk.Label(
            welcome_frame,
            text="Select a service from the sidebar to start testing endpoints",
            font=('Segoe UI', 11),
            foreground='gray'
        )
        instruction_label.pack()
        
        # Service status overview
        status_overview_label = ttk.Label(
            welcome_frame,
            text="Service status indicators are shown in the footer",
            font=('Segoe UI', 9),
            foreground='gray'
        )
        status_overview_label.pack(pady=(20, 0))
    
    def _create_footer(self):
        """Create footer area for health status indicators."""
        # Footer title
        footer_title = ttk.Label(
            self.footer_frame,
            text="Service Health Status:",
            font=('Segoe UI', 9, 'bold')
        )
        footer_title.grid(row=0, column=0, sticky='w', padx=10, pady=(5, 0))
        
        # Health status indicators frame
        self.health_status_frame = ttk.Frame(self.footer_frame)
        self.health_status_frame.grid(row=1, column=0, columnspan=2, sticky='ew', padx=10, pady=(2, 5))
        
        # Enhanced status bar for real-time feedback
        self.status_bar = StatusBar(self.footer_frame)
        self.status_bar.grid(row=0, column=1, rowspan=2, sticky='ew', padx=(10, 10), pady=5)
    
    def _setup_event_bindings(self):
        """Set up event bindings for window and component interactions."""
        # Window resize handling
        self.root.bind("<Configure>", self._on_window_configure)
        
        # Keyboard shortcuts
        self.root.bind("<Control-r>", lambda e: self._refresh_services())
        self.root.bind("<F5>", lambda e: self._refresh_services())
        self.root.bind("<Control-q>", lambda e: self._on_window_closing())
        self.root.bind("<Control-h>", lambda e: self.force_health_check_all())
        self.root.bind("<F6>", lambda e: self.force_health_check_all())
        self.root.bind("<Control-i>", lambda e: self._show_health_summary_dialog())
        
        # Focus handling
        self.root.bind("<FocusIn>", self._on_window_focus)
    
    def _setup_error_handling(self):
        """Set up error handling for the main window."""
        try:
            self.error_handler = get_error_handler(self.root)
            
            # Register error callbacks for different categories
            from utils.error_handler import ErrorCategory
            
            self.error_handler.register_error_callback(
                ErrorCategory.NETWORK, 
                self._handle_network_error
            )
            self.error_handler.register_error_callback(
                ErrorCategory.SERVICE, 
                self._handle_service_error
            )
            self.error_handler.register_error_callback(
                ErrorCategory.CONFIGURATION, 
                self._handle_config_error
            )
            
            self.logger.info("Error handling initialized for main window")
        except Exception as e:
            self.logger.error(f"Failed to setup error handling: {e}")
            # Show fallback error message
            if self.status_bar:
                self.status_bar.set_error_status("Error handling setup failed")
    
    def _initialize_services(self):
        """Initialize service list and UI components based on available services."""
        services = self.service_manager.get_available_services()

        # Add Agentic Services as a special service if available
        if AGENTIC_SERVICES_AVAILABLE:
            # Create a mock service config for Agentic Services
            from config.service_config import ServiceConfig, AuthType
            agentic_service = ServiceConfig(
                name="🤖 Agentic Services",
                endpoint="internal://agentic-services",
                auth_type=AuthType.NONE,
                timeout=30000,
                sample_endpoints=[]
            )
            services.insert(0, agentic_service)  # Add at the beginning

        if not services:
            self.logger.warning("No services available for initialization")
            self._update_status_bar("No services configured")
            return

        # Clear existing service buttons
        self.service_buttons.clear()

        # Create service buttons in sidebar
        for i, service in enumerate(services):
            self._create_service_button(service, i)

        # Create health status indicators in footer
        self._create_health_indicators(services)

        self.logger.info(f"Initialized {len(services)} services in UI")
        self._update_status_bar(f"Loaded {len(services)} services")
    
    def _create_service_button(self, service: ServiceConfig, index: int):
        """
        Create a service selection button in the sidebar.
        
        Args:
            service: Service configuration
            index: Index position for layout
        """
        button_frame = ttk.Frame(self.service_scrollable_frame)
        button_frame.grid(row=index, column=0, sticky='ew', padx=5, pady=2)
        button_frame.columnconfigure(0, weight=1)
        
        # Service button
        service_button = ttk.Button(
            button_frame,
            text=service.name,
            command=lambda s=service.name: self.on_service_selected(s)
        )
        service_button.grid(row=0, column=0, sticky='ew')
        
        # Add right-click context menu for health actions
        self._add_service_context_menu(service_button, service.name)
        
        # Store button reference
        self.service_buttons[service.name] = service_button
        
        # Add service endpoint info
        endpoint_label = ttk.Label(
            button_frame,
            text=f"→ {service.endpoint}",
            font=('Segoe UI', 8),
            foreground='gray'
        )
        endpoint_label.grid(row=1, column=0, sticky='w', padx=(10, 0))
    
    def _add_service_context_menu(self, widget: tk.Widget, service_name: str):
        """
        Add context menu to service widget for health actions.
        
        Args:
            widget: Widget to add context menu to
            service_name: Name of the service
        """
        try:
            context_menu = tk.Menu(widget, tearoff=0)
            
            context_menu.add_command(
                label=f"Check Health - {service_name}",
                command=lambda: self._force_service_health_check(service_name)
            )
            
            context_menu.add_separator()
            
            context_menu.add_command(
                label="Show Health Details",
                command=lambda: self._show_service_health_details(service_name)
            )
            
            context_menu.add_command(
                label="View Service Config",
                command=lambda: self._show_service_config_dialog(service_name)
            )
            
            def show_context_menu(event):
                try:
                    context_menu.tk_popup(event.x_root, event.y_root)
                finally:
                    context_menu.grab_release()
            
            widget.bind("<Button-3>", show_context_menu)  # Right-click
            
        except Exception as e:
            self.logger.error(f"Error adding context menu to service {service_name}: {e}")
    
    def _force_service_health_check(self, service_name: str):
        """Force health check for a specific service."""
        if not self.event_loop:
            self.logger.warning("No event loop available for health check")
            return
        
        try:
            # Show progress feedback
            self._update_status_bar(f"Checking health for {service_name}...")
            
            # Force health check for specific service
            asyncio.run_coroutine_threadsafe(
                self.service_manager.force_health_check(service_name),
                self.event_loop
            )
            
            self.logger.info(f"Forced health check for service: {service_name}")
            
        except Exception as e:
            self.logger.error(f"Error forcing health check for {service_name}: {e}")
    
    def _show_service_health_details(self, service_name: str):
        """Show detailed health information for a specific service."""
        try:
            from tkinter import messagebox
            
            health_info = self.service_manager.get_service_health(service_name)
            
            if not health_info:
                messagebox.showwarning("Health Details", f"No health information available for {service_name}")
                return
            
            # Format detailed health information
            details = [
                f"Service: {service_name}",
                f"Status: {health_info.status.value}",
                f"Last Check: {health_info.last_check.strftime('%Y-%m-%d %H:%M:%S') if health_info.last_check else 'Never'}",
                f"Response Time: {health_info.response_time:.1f}ms" if health_info.response_time else "Response Time: N/A",
                f"Total Checks: {health_info.total_checks}",
                f"Consecutive Successes: {health_info.consecutive_successes}",
                f"Consecutive Failures: {health_info.consecutive_failures}",
                f"Uptime: {health_info.uptime_percentage:.1f}%"
            ]
            
            if health_info.error_details:
                details.append(f"Last Error: {health_info.error_details}")
            
            message = "\n".join(details)
            messagebox.showinfo(f"Health Details - {service_name}", message)
            
        except Exception as e:
            self.logger.error(f"Error showing health details for {service_name}: {e}")
            messagebox.showerror("Error", f"Failed to show health details: {str(e)}")
    
    def _show_service_config_dialog(self, service_name: str):
        """Show service configuration details."""
        try:
            from tkinter import messagebox
            
            service_config = self.service_manager.get_service_config(service_name)
            
            if not service_config:
                messagebox.showwarning("Service Config", f"No configuration found for {service_name}")
                return
            
            # Format configuration details
            config_details = [
                f"Service: {service_config.name}",
                f"Endpoint: {service_config.endpoint}",
                f"Auth Type: {service_config.auth_type.value}",
                f"Timeout: {service_config.timeout}ms",
                f"Sample Endpoints: {len(service_config.sample_endpoints)}"
            ]
            
            if service_config.rate_limit:
                config_details.append(f"Rate Limit: {service_config.rate_limit.requests_per_minute} req/min")
            
            if service_config.circuit_breaker:
                config_details.append(f"Circuit Breaker: {service_config.circuit_breaker.failure_threshold} failures")
            
            message = "\n".join(config_details)
            messagebox.showinfo(f"Configuration - {service_name}", message)
            
        except Exception as e:
            self.logger.error(f"Error showing config for {service_name}: {e}")
            messagebox.showerror("Error", f"Failed to show service configuration: {str(e)}")
    
    def _create_health_indicators(self, services: List[ServiceConfig]):
        """
        Create health status indicators in the footer.
        
        Args:
            services: List of service configurations
        """
        # Clear existing indicators
        for indicator in self.service_status_indicators.values():
            indicator.destroy()
        self.service_status_indicators.clear()
        
        # Create new indicators
        for i, service in enumerate(services):
            indicator = StatusIndicator(
                self.health_status_frame,
                service_name=service.name,
                initial_status=HealthStatus.UNKNOWN,
                show_text=True,
                show_response_time=True,
                on_click=self._on_health_indicator_click
            )
            indicator.grid(row=0, column=i, padx=(0, 15), pady=2, sticky='w')
            
            self.service_status_indicators[service.name] = indicator
    
    def _setup_health_monitoring(self):
        """Set up health monitoring callbacks."""
        self.service_manager.add_health_status_callback(self._on_health_status_change)
    
    def on_service_selected(self, service_name: str):
        """
        Handle service selection from sidebar.
        
        Args:
            service_name: Name of the selected service
        """
        if service_name == self.selected_service:
            return  # Already selected
        
        self.logger.info(f"Service selected: {service_name}")
        self.selected_service = service_name
        
        # Update UI state
        self._update_service_button_states()
        self._update_service_info_display(service_name)
        self._create_service_panel(service_name)
        
        # Update status bar
        self._update_status_bar(f"Selected service: {service_name}")
    
    def _update_service_button_states(self):
        """Update visual state of service buttons to show selection."""
        for service_name, button in self.service_buttons.items():
            if service_name == self.selected_service:
                button.configure(style='Accent.TButton')
            else:
                button.configure(style='TButton')
    
    def _update_service_info_display(self, service_name: str):
        """
        Update the service information display in the main panel.
        
        Args:
            service_name: Name of the selected service
        """
        service_config = self.service_manager.get_service_config(service_name)
        if not service_config:
            self.service_info_label.configure(text=f"Service '{service_name}' not found")
            return
        
        info_text = f"Testing: {service_name} ({service_config.endpoint})"
        self.service_info_label.configure(text=info_text, foreground='black')
    
    def _create_service_panel(self, service_name: str):
        """
        Create service-specific panel for endpoint testing.

        Args:
            service_name: Name of the service to create panel for
        """
        # Remove existing service panel
        if self.current_service_panel:
            self.current_service_panel.destroy()

        # Hide default content
        if hasattr(self, 'default_content'):
            self.default_content.grid_remove()

        # Handle special Agentic Services panel
        if service_name == "🤖 Agentic Services" and AGENTIC_SERVICES_AVAILABLE:
            try:
                self.agentic_services_panel = AgenticServicesPanel(
                    self.content_frame,
                    on_status_change=self._on_agentic_services_status_change
                )
                self.current_service_panel = self.agentic_services_panel.main_frame
                self.current_service_panel.grid(row=0, column=0, sticky='nsew')

                self.logger.info("Created Agentic Services panel")

            except Exception as e:
                self.logger.error(f"Error creating Agentic Services panel: {e}")

                # Fallback to error display
                self.current_service_panel = ttk.Frame(self.content_frame)
                self.current_service_panel.grid(row=0, column=0, sticky='nsew')

                error_label = ttk.Label(
                    self.current_service_panel,
                    text=f"Error loading Agentic Services panel: {str(e)}",
                    font=('Segoe UI', 10),
                    foreground='red'
                )
                error_label.place(relx=0.5, rely=0.5, anchor='center')
        else:
            # Create regular service panel
            try:
                self.current_service_panel = ServicePanel(
                    self.content_frame,
                    service_manager=self.service_manager,
                    service_name=service_name,
                    event_loop=self.event_loop
                )
                self.current_service_panel.grid(row=0, column=0, sticky='nsew')

                self.logger.info(f"Created service panel for {service_name}")

            except Exception as e:
                self.logger.error(f"Error creating service panel for {service_name}: {e}")

                # Fallback to error display
                self.current_service_panel = ttk.Frame(self.content_frame)
                self.current_service_panel.grid(row=0, column=0, sticky='nsew')

                error_label = ttk.Label(
                    self.current_service_panel,
                    text=f"Error loading service panel: {str(e)}",
                    font=('Segoe UI', 10),
                    foreground='red'
                )
                error_label.place(relx=0.5, rely=0.5, anchor='center')
    
    def _on_health_status_change(self, service_name: str, health_info: ServiceHealthInfo):
        """
        Handle health status changes from the service manager.
        
        Args:
            service_name: Name of the service with status change
            health_info: Updated health information
        """
        # Update status indicator if it exists
        if service_name in self.service_status_indicators:
            indicator = self.service_status_indicators[service_name]
            indicator.update_status(health_info.status, health_info)
        
        # Update status bar with latest change
        status_text = f"{service_name}: {health_info.status.value}"
        if health_info.response_time is not None:
            status_text += f" ({health_info.response_time:.1f}ms)"
        
        self._update_status_bar(status_text)
        
        self.logger.debug(f"Health status updated: {service_name} -> {health_info.status}")
    
    def _on_health_indicator_click(self, service_name: str):
        """
        Handle clicks on health status indicators.
        
        Args:
            service_name: Name of the service whose indicator was clicked
        """
        # Select the service when its health indicator is clicked
        self.on_service_selected(service_name)
        
        # Force a health check using the background event loop
        if self.event_loop:
            try:
                asyncio.run_coroutine_threadsafe(
                    self.service_manager.force_health_check(service_name),
                    self.event_loop
                )
            except Exception as e:
                self.logger.error(f"Error scheduling health check: {e}")
        else:
            self.logger.warning("No event loop available for health check")
        
        self._update_status_bar(f"Checking health for {service_name}...")
    
    def _refresh_services(self):
        """Refresh service list and reinitialize UI components."""
        self.logger.info("Refreshing services")
        self._update_status_bar("Refreshing services...")
        
        # Clear current selection
        self.selected_service = None
        
        # Remove current service panel
        if self.current_service_panel:
            self.current_service_panel.destroy()
            self.current_service_panel = None
        
        # Show default content
        if hasattr(self, 'default_content'):
            self.default_content.grid()
        
        # Reinitialize services
        self._initialize_services()
        
        # Update service info display
        self.service_info_label.configure(
            text="Select a service from the sidebar to begin testing",
            foreground='gray'
        )
        
        # Force health check for all services
        self.force_health_check_all()
        
        self._update_status_bar("Services refreshed")
    
    def _update_status_bar(self, message: str):
        """
        Update status bar with a message.

        Args:
            message: Status message to display
        """
        if self.status_bar:
            self.status_bar.set_status(message, StatusType.INFO, auto_clear=False)
    
    def _on_mousewheel(self, event):
        """Handle mouse wheel scrolling in service list."""
        self.service_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
    
    def _on_window_configure(self, event):
        """Handle window resize events."""
        if event.widget == self.root:
            # Update canvas scroll region when window is resized
            self.service_canvas.configure(scrollregion=self.service_canvas.bbox("all"))
    
    def _on_window_focus(self, event):
        """Handle window focus events."""
        # Could be used for refreshing data when window regains focus
        pass
    
    def _on_window_closing(self):
        """Handle window closing event."""
        self.logger.info("Application closing")
        
        # The actual cleanup will be handled by the main app
        # Just close the window here
        if self.root:
            self.root.quit()
            self.root.destroy()
    
    def _handle_network_error(self, error_info):
        """Handle network-related errors."""
        if self.status_bar:
            self.status_bar.set_error_status(f"Network error: {error_info.message}")
        
        # Update health indicators to show network issues
        for service_name, indicator in self.service_status_indicators.items():
            if "connection" in error_info.message.lower() or "network" in error_info.message.lower():
                from services.health_checker import HealthStatus
                indicator.update_status(HealthStatus.DOWN, None)
    
    def _handle_service_error(self, error_info):
        """Handle service-related errors."""
        if self.status_bar:
            self.status_bar.set_error_status(f"Service error: {error_info.message}")
        
        # If error context contains service name, update specific indicator
        if error_info.context and 'service_name' in error_info.context:
            service_name = error_info.context['service_name']
            if service_name in self.service_status_indicators:
                from services.health_checker import HealthStatus
                self.service_status_indicators[service_name].update_status(HealthStatus.DOWN, None)
    
    def _handle_config_error(self, error_info):
        """Handle configuration-related errors."""
        if self.status_bar:
            self.status_bar.set_error_status(f"Config error: {error_info.message}")
        
        # Configuration errors might affect all services
        self._update_status_bar("Configuration issue detected - some features may not work")
    
    def show_error_dialog(self, title: str, message: str, error_type: str = "error"):
        """
        Show error dialog to user.
        
        Args:
            title: Dialog title
            message: Error message
            error_type: Type of error (error, warning, info)
        """
        try:
            from tkinter import messagebox
            
            if error_type == "warning":
                messagebox.showwarning(title, message, parent=self.root)
            elif error_type == "info":
                messagebox.showinfo(title, message, parent=self.root)
            else:
                messagebox.showerror(title, message, parent=self.root)
                
        except Exception as e:
            self.logger.error(f"Error showing dialog: {e}")
            # Fallback to status bar
            if self.status_bar:
                self.status_bar.set_error_status(f"{title}: {message}")
    
    def handle_application_error(self, error: Exception, context: str = ""):
        """
        Handle application-level errors with comprehensive feedback.
        
        Args:
            error: The exception that occurred
            context: Additional context about where the error occurred
        """
        try:
            # Use the error handler to process the error
            error_info = self.error_handler.handle_error(
                error, 
                context={'location': context} if context else None,
                show_dialog=True
            )
            
            # Update status bar
            if self.status_bar:
                self.status_bar.set_error_status(f"Error: {error_info.user_message}")
            
            # Log for debugging
            self.logger.error(f"Application error in {context}: {error}", exc_info=True)
            
        except Exception as e:
            # Fallback error handling
            self.logger.critical(f"Critical error in error handling: {e}", exc_info=True)
            
            if self.status_bar:
                self.status_bar.set_error_status("Critical application error occurred")
            
            # Show basic error dialog as last resort
            try:
                from tkinter import messagebox
                messagebox.showerror(
                    "Critical Error", 
                    "A critical error occurred. Please restart the application.",
                    parent=self.root
                )
            except:
                pass
    
    def _show_health_summary_dialog(self):
        """Show comprehensive health summary dialog."""
        try:
            # Create health summary dialog
            dialog = tk.Toplevel(self.root)
            dialog.title("Service Health Summary")
            dialog.geometry("600x400")
            dialog.resizable(True, True)
            dialog.transient(self.root)
            dialog.grab_set()
            
            # Main frame
            main_frame = tk.Frame(dialog, padx=20, pady=20)
            main_frame.pack(fill=tk.BOTH, expand=True)
            
            # Title
            title_label = tk.Label(
                main_frame,
                text="Service Health Summary",
                font=('Segoe UI', 12, 'bold')
            )
            title_label.pack(anchor=tk.W, pady=(0, 10))
            
            # Create scrollable text area for health details
            text_frame = tk.Frame(main_frame)
            text_frame.pack(fill=tk.BOTH, expand=True)
            
            text_widget = tk.Text(
                text_frame,
                wrap=tk.WORD,
                font=('Consolas', 9),
                state=tk.DISABLED
            )
            scrollbar = ttk.Scrollbar(text_frame, orient=tk.VERTICAL, command=text_widget.yview)
            text_widget.configure(yscrollcommand=scrollbar.set)
            
            text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            
            # Populate health information
            text_widget.configure(state=tk.NORMAL)
            
            services = self.service_manager.get_available_services()
            for service in services:
                health_info = self.service_manager.get_service_health(service.name)
                
                text_widget.insert(tk.END, f"=== {service.name} ===\n")
                text_widget.insert(tk.END, f"Endpoint: {service.endpoint}\n")
                
                if health_info:
                    text_widget.insert(tk.END, f"Status: {health_info.status.value}\n")
                    text_widget.insert(tk.END, f"Last Check: {health_info.last_check.strftime('%Y-%m-%d %H:%M:%S') if health_info.last_check else 'Never'}\n")
                    text_widget.insert(tk.END, f"Response Time: {health_info.response_time:.1f}ms\n" if health_info.response_time else "Response Time: N/A\n")
                    text_widget.insert(tk.END, f"Total Checks: {health_info.total_checks}\n")
                    text_widget.insert(tk.END, f"Uptime: {health_info.uptime_percentage:.1f}%\n")
                    
                    if health_info.error_details:
                        text_widget.insert(tk.END, f"Last Error: {health_info.error_details}\n")
                else:
                    text_widget.insert(tk.END, "No health information available\n")
                
                text_widget.insert(tk.END, "\n")
            
            text_widget.configure(state=tk.DISABLED)
            
            # Button frame
            button_frame = tk.Frame(main_frame)
            button_frame.pack(fill=tk.X, pady=(10, 0))
            
            # Refresh button
            refresh_button = tk.Button(
                button_frame,
                text="Refresh All",
                command=lambda: self.force_health_check_all()
            )
            refresh_button.pack(side=tk.LEFT)
            
            # Close button
            close_button = tk.Button(
                button_frame,
                text="Close",
                command=dialog.destroy
            )
            close_button.pack(side=tk.RIGHT)
            
            dialog.protocol("WM_DELETE_WINDOW", dialog.destroy)
            
        except Exception as e:
            self.logger.error(f"Error showing health summary dialog: {e}")
            self.handle_application_error(e, "health_summary_dialog")
    
    def force_health_check_all(self):
        """Force health check for all services."""
        if not self.event_loop:
            self.logger.warning("No event loop available for health checks")
            if self.status_bar:
                self.status_bar.set_warning_status("Health checks unavailable")
            return
        
        try:
            # Show progress feedback
            if self.status_bar:
                self.status_bar.set_progress_status("Checking health for all services...")
            
            # Force health check for all services
            services = self.service_manager.get_available_services()
            for service in services:
                asyncio.run_coroutine_threadsafe(
                    self.service_manager.force_health_check(service.name),
                    self.event_loop
                )
            
            self.logger.info("Forced health check for all services")
            
            # Clear progress after a delay
            self.root.after(3000, lambda: self.status_bar.set_success_status("Health checks completed") if self.status_bar else None)
            
        except Exception as e:
            self.logger.error(f"Error forcing health checks: {e}")
            self.handle_application_error(e, "force_health_check_all")
    
    def _start_health_ui_updates(self):
        """Start periodic UI updates for health status."""
        def update_health_ui():
            try:
                # This will be called periodically to update UI elements
                # The actual health checking is done by the service manager
                
                # Update status bar with current time if no other message
                if self.status_bar and self.status_bar.get_current_status()['message'] == "Ready":
                    current_time = datetime.now().strftime("%H:%M:%S")
                    self.status_bar.set_status(f"Ready - {current_time}", auto_clear=False)
                
                # Schedule next update
                self.root.after(30000, update_health_ui)  # Every 30 seconds
                
            except Exception as e:
                self.logger.error(f"Error in health UI update: {e}")
        
        # Start the periodic updates
        self.root.after(1000, update_health_ui)  # Start after 1 second
    
    def run(self):
        """Start the main application event loop."""
        if not self.root:
            raise RuntimeError("Window not created. Call create_window() first.")
        
        try:
            self.logger.info("Starting main application event loop")
            if self.status_bar:
                self.status_bar.set_success_status("Application started successfully")
            
            self.root.mainloop()
            
        except Exception as e:
            self.logger.critical(f"Critical error in main event loop: {e}", exc_info=True)
            self.handle_application_error(e, "main_event_loop")
        finally:
            self.logger.info("Main event loop ended")
            self.logger.info("Application loop ended")
    
    def get_selected_service(self) -> Optional[str]:
        """
        Get the currently selected service name.
        
        Returns:
            Selected service name or None
        """
        return self.selected_service
    
    def select_service_programmatically(self, service_name: str) -> bool:
        """
        Programmatically select a service.
        
        Args:
            service_name: Name of the service to select
            
        Returns:
            True if service was selected, False if service not found
        """
        if service_name in self.service_buttons:
            self.on_service_selected(service_name)
            return True
        return False
    
    def _setup_health_monitoring(self):
        """Set up health monitoring callbacks and real-time updates."""
        # Add callback to service manager for health status changes
        self.service_manager.add_health_status_callback(self._on_health_status_change)
        
        # Force initial health check for all services
        if self.event_loop:
            try:
                asyncio.run_coroutine_threadsafe(
                    self.service_manager.force_health_check(),
                    self.event_loop
                )
            except Exception as e:
                self.logger.error(f"Error forcing initial health check: {e}")
        
        self.logger.info("Health monitoring callbacks set up")
    
    def _start_health_ui_updates(self):
        """Start periodic UI updates for health status indicators."""
        self._update_health_indicators()
        # Schedule next update in 5 seconds
        if self.root:
            self.root.after(5000, self._start_health_ui_updates)
    
    def _update_health_indicators(self):
        """Update all health status indicators with current data."""
        try:
            # Get current health info for all services
            all_health_info = self.service_manager.get_all_health_info()
            
            for service_name, health_info in all_health_info.items():
                if service_name in self.service_status_indicators:
                    indicator = self.service_status_indicators[service_name]
                    indicator.update_status(health_info.status, health_info)
            
            # Update overall status in status bar
            healthy_count = sum(1 for info in all_health_info.values() if info.status == HealthStatus.HEALTHY)
            total_count = len(all_health_info)
            
            if total_count > 0:
                health_percentage = (healthy_count / total_count) * 100
                status_msg = f"Services: {healthy_count}/{total_count} healthy ({health_percentage:.0f}%)"
                self._update_status_bar(status_msg)
            
        except Exception as e:
            self.logger.error(f"Error updating health indicators: {e}")
    
    def _on_health_status_change(self, service_name: str, health_info: ServiceHealthInfo):
        """
        Handle health status changes from the service manager.
        
        Args:
            service_name: Name of the service with status change
            health_info: Updated health information
        """
        # Schedule UI update on main thread
        self.after_idle(lambda: self._handle_health_status_change(service_name, health_info))
    
    def _handle_health_status_change(self, service_name: str, health_info: ServiceHealthInfo):
        """
        Handle health status change on the main UI thread.
        
        Args:
            service_name: Name of the service with status change
            health_info: Updated health information
        """
        try:
            # Update status indicator if it exists
            if service_name in self.service_status_indicators:
                indicator = self.service_status_indicators[service_name]
                indicator.update_status(health_info.status, health_info)
                
                # Add visual feedback for status changes
                self._show_health_change_feedback(service_name, health_info)
            
            # Update status bar with latest change
            status_text = f"{service_name}: {health_info.status.value}"
            if health_info.response_time is not None:
                status_text += f" ({health_info.response_time:.1f}ms)"
            
            self._update_status_bar(status_text)
            
            # Log significant status changes
            if health_info.status == HealthStatus.UNHEALTHY:
                self.logger.warning(f"Service {service_name} became unhealthy: {health_info.error_details}")
            elif health_info.status == HealthStatus.HEALTHY and health_info.consecutive_successes == 1:
                self.logger.info(f"Service {service_name} recovered and is now healthy")
            
            self.logger.debug(f"Health status updated: {service_name} -> {health_info.status}")
            
        except Exception as e:
            self.logger.error(f"Error handling health status change: {e}")
    
    def _show_health_change_feedback(self, service_name: str, health_info: ServiceHealthInfo):
        """
        Show visual feedback for health status changes.
        
        Args:
            service_name: Name of the service
            health_info: Health information
        """
        try:
            # Flash the service button to indicate status change
            if service_name in self.service_buttons:
                button = self.service_buttons[service_name]
                original_style = button.cget('style')
                
                # Flash with appropriate color
                if health_info.status == HealthStatus.HEALTHY:
                    flash_style = 'success.TButton'
                elif health_info.status == HealthStatus.UNHEALTHY:
                    flash_style = 'danger.TButton'
                else:
                    flash_style = 'warning.TButton'
                
                # Apply flash style
                button.configure(style=flash_style)
                
                # Restore original style after 1 second
                self.after(1000, lambda: button.configure(style=original_style))
            
            # Show tooltip-like notification for critical status changes
            if health_info.status == HealthStatus.UNHEALTHY:
                self._show_health_notification(service_name, "Service became unhealthy", "error")
            elif health_info.status == HealthStatus.HEALTHY and health_info.consecutive_successes == 1:
                self._show_health_notification(service_name, "Service recovered", "success")
                
        except Exception as e:
            self.logger.error(f"Error showing health change feedback: {e}")
    
    def _show_health_notification(self, service_name: str, message: str, notification_type: str):
        """
        Show a temporary notification for health status changes.
        
        Args:
            service_name: Name of the service
            message: Notification message
            notification_type: Type of notification (success, error, warning)
        """
        try:
            # Create notification popup
            notification = tk.Toplevel(self.root)
            notification.withdraw()
            notification.overrideredirect(True)
            notification.attributes('-topmost', True)
            
            # Configure notification appearance
            bg_color = {
                'success': '#d4edda',
                'error': '#f8d7da',
                'warning': '#fff3cd'
            }.get(notification_type, '#e2e3e5')
            
            text_color = {
                'success': '#155724',
                'error': '#721c24',
                'warning': '#856404'
            }.get(notification_type, '#383d41')
            
            notification.configure(bg=bg_color, relief='solid', borderwidth=1)
            
            # Notification content
            notification_frame = tk.Frame(notification, bg=bg_color)
            notification_frame.pack(padx=10, pady=8)
            
            title_label = tk.Label(
                notification_frame,
                text=service_name,
                font=('Segoe UI', 9, 'bold'),
                bg=bg_color,
                fg=text_color
            )
            title_label.pack()
            
            message_label = tk.Label(
                notification_frame,
                text=message,
                font=('Segoe UI', 8),
                bg=bg_color,
                fg=text_color
            )
            message_label.pack()
            
            # Position notification in bottom-right corner
            notification.update_idletasks()
            x = self.root.winfo_rootx() + self.root.winfo_width() - notification.winfo_width() - 20
            y = self.root.winfo_rooty() + self.root.winfo_height() - notification.winfo_height() - 60
            
            notification.geometry(f"+{x}+{y}")
            notification.deiconify()
            
            # Auto-hide notification after 3 seconds
            self.after(3000, notification.destroy)
            
        except Exception as e:
            self.logger.error(f"Error showing health notification: {e}")
    
    def _create_health_progress_indicator(self):
        """Create a visual progress indicator for health checks."""
        try:
            # Add progress indicator to footer
            self.health_progress = ttk.Progressbar(
                self.footer_frame,
                mode='indeterminate',
                length=100
            )
            
            # Position it next to the status bar
            self.health_progress.grid(row=0, column=2, sticky='e', padx=(5, 10), pady=5)
            
            return self.health_progress
            
        except Exception as e:
            self.logger.error(f"Error creating health progress indicator: {e}")
            return None
    
    def _show_health_check_progress(self, show: bool = True):
        """Show or hide health check progress indicator."""
        try:
            if not hasattr(self, 'health_progress'):
                self.health_progress = self._create_health_progress_indicator()
            
            if self.health_progress:
                if show:
                    self.health_progress.grid()
                    self.health_progress.start()
                    self._update_status_bar("Checking service health...")
                else:
                    self.health_progress.stop()
                    self.health_progress.grid_remove()
                    
        except Exception as e:
            self.logger.error(f"Error controlling health check progress: {e}")
    
    def force_health_check_all(self):
        """Force health check for all services with UI feedback."""
        if not self.event_loop:
            self.logger.warning("No event loop available for health check")
            return
        
        try:
            # Show progress indicator
            self._show_health_check_progress(True)
            
            # Force health check
            future = asyncio.run_coroutine_threadsafe(
                self.service_manager.force_health_check(),
                self.event_loop
            )
            
            # Schedule progress indicator hide after reasonable time
            self.after(5000, lambda: self._show_health_check_progress(False))
            
            self.logger.info("Forced health check for all services")
            
        except Exception as e:
            self.logger.error(f"Error forcing health check: {e}")
            self._show_health_check_progress(False)
    
    def _show_health_summary_dialog(self):
        """Show a dialog with detailed health summary information."""
        try:
            from tkinter import messagebox
            
            summary = self.get_service_health_summary()
            
            if not summary:
                messagebox.showwarning("Health Summary", "No health information available")
                return
            
            # Format summary message
            message_lines = [
                f"Total Services: {summary['total_services']}",
                f"Healthy: {summary['healthy_services']}",
                f"Unhealthy: {summary['unhealthy_services']}",
                f"Unknown: {summary['unknown_services']}",
                f"Checking: {summary['checking_services']}",
                f"Average Response Time: {summary['average_response_time']:.1f}ms",
                "",
                "Service Details:"
            ]
            
            for service_name, service_info in summary['services'].items():
                status_line = f"• {service_name}: {service_info['status']}"
                if service_info['response_time']:
                    status_line += f" ({service_info['response_time']:.1f}ms)"
                if service_info['uptime_percentage'] > 0:
                    status_line += f" - {service_info['uptime_percentage']:.1f}% uptime"
                message_lines.append(status_line)
            
            message = "\n".join(message_lines)
            
            messagebox.showinfo("Health Summary", message)
            
        except Exception as e:
            self.logger.error(f"Error showing health summary dialog: {e}")
            messagebox.showerror("Error", f"Failed to show health summary: {str(e)}")
    
    def get_service_health_summary(self) -> Dict[str, Any]:
        """
        Get a summary of all service health statuses.
        
        Returns:
            Dictionary with health summary information
        """
        try:
            all_health_info = self.service_manager.get_all_health_info()
            
            summary = {
                'total_services': len(all_health_info),
                'healthy_services': 0,
                'unhealthy_services': 0,
                'unknown_services': 0,
                'checking_services': 0,
                'average_response_time': 0.0,
                'services': {}
            }
            
            total_response_time = 0.0
            response_time_count = 0
            
            for service_name, health_info in all_health_info.items():
                summary['services'][service_name] = {
                    'status': health_info.status.value,
                    'response_time': health_info.response_time,
                    'last_check': health_info.last_check.isoformat() if health_info.last_check else None,
                    'uptime_percentage': health_info.uptime_percentage
                }
                
                # Count by status
                if health_info.status == HealthStatus.HEALTHY:
                    summary['healthy_services'] += 1
                elif health_info.status == HealthStatus.UNHEALTHY:
                    summary['unhealthy_services'] += 1
                elif health_info.status == HealthStatus.UNKNOWN:
                    summary['unknown_services'] += 1
                elif health_info.status == HealthStatus.CHECKING:
                    summary['checking_services'] += 1
                
                # Calculate average response time
                if health_info.response_time is not None:
                    total_response_time += health_info.response_time
                    response_time_count += 1
            
            if response_time_count > 0:
                summary['average_response_time'] = total_response_time / response_time_count
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Error getting health summary: {e}")
            return {}
    
    def update_health_status(self, service_name: str, status: HealthStatus):
        """
        Update health status for a service (external interface).

        Args:
            service_name: Name of the service
            status: New health status
        """
        if service_name in self.service_status_indicators:
            indicator = self.service_status_indicators[service_name]
            indicator.update_status(status)

    def _on_agentic_services_status_change(self, status_info: Dict[str, Any]):
        """
        Handle status changes from the Agentic Services panel.

        Args:
            status_info: Status information from the panel
        """
        try:
            # Update status bar with Agentic Services status
            if status_info.get("system_running"):
                self._update_status_bar("🤖 Agentic Services: Running")
            else:
                self._update_status_bar("🤖 Agentic Services: Stopped")

            self.logger.info(f"Agentic Services status changed: {status_info}")

        except Exception as e:
            self.logger.error(f"Error handling Agentic Services status change: {e}")