"""
Enhanced sample endpoints panel with categorization, search, and detailed information.
"""
import tkinter as tk
from tkinter import ttk, messagebox
from typing import List, Dict, Optional, Callable, Any
import json

from services.service_manager import EndpointInfo


class SampleEndpointsPanel(ttk.Frame):
    """
    Enhanced panel for displaying and managing sample endpoints.
    
    Features:
    - Category-based organization
    - Search functionality
    - Detailed endpoint information
    - Quick execution buttons
    - Payload preview
    """
    
    def __init__(self, 
                 parent,
                 service_name: str,
                 endpoints: List[EndpointInfo],
                 on_endpoint_selected: Optional[Callable[[EndpointInfo], None]] = None,
                 on_endpoint_executed: Optional[Callable[[EndpointInfo], None]] = None,
                 **kwargs):
        """
        Initialize sample endpoints panel.
        
        Args:
            parent: Parent widget
            service_name: Name of the service
            endpoints: List of sample endpoints
            on_endpoint_selected: Callback when endpoint is selected
            on_endpoint_executed: Callback when endpoint is executed
            **kwargs: Additional frame arguments
        """
        super().__init__(parent, **kwargs)
        
        self.service_name = service_name
        self.endpoints = endpoints
        self.on_endpoint_selected = on_endpoint_selected
        self.on_endpoint_executed = on_endpoint_executed
        
        # State
        self.filtered_endpoints = endpoints.copy()
        self.selected_endpoint: Optional[EndpointInfo] = None
        self.categories: List[str] = []
        
        # UI components
        self.search_var = tk.StringVar()
        self.category_var = tk.StringVar()
        
        # Create UI
        self._extract_categories()
        self._create_widgets()
        self._setup_layout()
        self._setup_bindings()
        self._update_endpoint_list()
    
    def _extract_categories(self):
        """Extract unique categories from endpoints."""
        categories = set()
        for endpoint in self.endpoints:
            # Try to get category from endpoint description or path
            if hasattr(endpoint, 'category'):
                categories.add(endpoint.category)
            else:
                # Infer category from path
                path_parts = [part for part in endpoint.path.split('/') if part and not part.startswith('{')]
                if path_parts:
                    categories.add(path_parts[0].title())
                else:
                    categories.add("General")
        
        self.categories = ["All"] + sorted(list(categories))
    
    def _create_widgets(self):
        """Create UI widgets."""
        # Search and filter frame
        self.filter_frame = ttk.Frame(self)
        
        # Search box
        ttk.Label(self.filter_frame, text="Search:").grid(row=0, column=0, sticky='w', padx=(0, 5))
        self.search_entry = ttk.Entry(
            self.filter_frame,
            textvariable=self.search_var,
            width=20
        )
        self.search_entry.grid(row=0, column=1, sticky='ew', padx=(0, 10))
        
        # Category filter
        ttk.Label(self.filter_frame, text="Category:").grid(row=0, column=2, sticky='w', padx=(0, 5))
        self.category_combo = ttk.Combobox(
            self.filter_frame,
            textvariable=self.category_var,
            values=self.categories,
            state='readonly',
            width=15
        )
        self.category_combo.grid(row=0, column=3, sticky='ew', padx=(0, 10))
        self.category_combo.set("All")
        
        # Clear filters button
        self.clear_button = ttk.Button(
            self.filter_frame,
            text="Clear",
            command=self._clear_filters,
            width=8
        )
        self.clear_button.grid(row=0, column=4, padx=(0, 5))
        
        # Configure column weights
        self.filter_frame.columnconfigure(1, weight=1)
        self.filter_frame.columnconfigure(3, weight=1)
        
        # Main content frame
        self.content_frame = ttk.Frame(self)
        
        # Endpoints list frame
        self.list_frame = ttk.LabelFrame(self.content_frame, text="Sample Endpoints", padding=5)
        
        # Create treeview for endpoints
        self.endpoints_tree = ttk.Treeview(
            self.list_frame,
            columns=('method', 'path', 'description'),
            show='tree headings',
            height=8
        )
        
        # Configure columns
        self.endpoints_tree.heading('#0', text='#')
        self.endpoints_tree.heading('method', text='Method')
        self.endpoints_tree.heading('path', text='Path')
        self.endpoints_tree.heading('description', text='Description')
        
        self.endpoints_tree.column('#0', width=40, minwidth=40)
        self.endpoints_tree.column('method', width=80, minwidth=60)
        self.endpoints_tree.column('path', width=200, minwidth=150)
        self.endpoints_tree.column('description', width=300, minwidth=200)
        
        # Scrollbar for treeview
        self.tree_scrollbar = ttk.Scrollbar(
            self.list_frame,
            orient='vertical',
            command=self.endpoints_tree.yview
        )
        self.endpoints_tree.configure(yscrollcommand=self.tree_scrollbar.set)
        
        # Endpoint details frame
        self.details_frame = ttk.LabelFrame(self.content_frame, text="Endpoint Details", padding=5)
        
        # Details text widget
        self.details_text = tk.Text(
            self.details_frame,
            height=8,
            wrap=tk.WORD,
            font=('Consolas', 9),
            state=tk.DISABLED
        )
        
        # Scrollbar for details
        self.details_scrollbar = ttk.Scrollbar(
            self.details_frame,
            orient='vertical',
            command=self.details_text.yview
        )
        self.details_text.configure(yscrollcommand=self.details_scrollbar.set)
        
        # Action buttons frame
        self.actions_frame = ttk.Frame(self.details_frame)
        
        self.select_button = ttk.Button(
            self.actions_frame,
            text="Select Endpoint",
            command=self._on_select_endpoint,
            state='disabled'
        )
        
        self.execute_button = ttk.Button(
            self.actions_frame,
            text="Execute Now",
            command=self._on_execute_endpoint,
            state='disabled'
        )
        
        self.copy_button = ttk.Button(
            self.actions_frame,
            text="Copy Details",
            command=self._on_copy_details,
            state='disabled'
        )
        
        # Status label
        self.status_label = ttk.Label(
            self,
            text=f"Showing {len(self.endpoints)} endpoints for {self.service_name}",
            font=('Segoe UI', 8),
            foreground='gray'
        )
    
    def _setup_layout(self):
        """Set up widget layout."""
        # Configure main grid weights
        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)
        
        # Filter frame
        self.filter_frame.grid(row=0, column=0, sticky='ew', padx=5, pady=(5, 10))
        
        # Content frame
        self.content_frame.grid(row=1, column=0, sticky='nsew', padx=5, pady=(0, 5))
        self.content_frame.columnconfigure(0, weight=1)
        self.content_frame.rowconfigure(0, weight=1)
        self.content_frame.rowconfigure(1, weight=1)
        
        # List frame
        self.list_frame.grid(row=0, column=0, sticky='nsew', pady=(0, 5))
        self.list_frame.columnconfigure(0, weight=1)
        self.list_frame.rowconfigure(0, weight=1)
        
        # Treeview and scrollbar
        self.endpoints_tree.grid(row=0, column=0, sticky='nsew')
        self.tree_scrollbar.grid(row=0, column=1, sticky='ns')
        
        # Details frame
        self.details_frame.grid(row=1, column=0, sticky='nsew')
        self.details_frame.columnconfigure(0, weight=1)
        self.details_frame.rowconfigure(0, weight=1)
        
        # Details text and scrollbar
        self.details_text.grid(row=0, column=0, sticky='nsew', pady=(0, 5))
        self.details_scrollbar.grid(row=0, column=1, sticky='ns', pady=(0, 5))
        
        # Actions frame
        self.actions_frame.grid(row=1, column=0, columnspan=2, sticky='ew')
        self.select_button.grid(row=0, column=0, padx=(0, 5))
        self.execute_button.grid(row=0, column=1, padx=(0, 5))
        self.copy_button.grid(row=0, column=2, padx=(0, 5))
        
        # Status label
        self.status_label.grid(row=2, column=0, sticky='w', padx=5, pady=(5, 0))
    
    def _setup_bindings(self):
        """Set up event bindings."""
        # Search and filter bindings
        self.search_var.trace('w', self._on_filter_change)
        self.category_var.trace('w', self._on_filter_change)
        
        # Treeview selection binding
        self.endpoints_tree.bind('<<TreeviewSelect>>', self._on_tree_selection)
        self.endpoints_tree.bind('<Double-1>', self._on_tree_double_click)
        
        # Context menu for treeview
        self.endpoints_tree.bind('<Button-3>', self._show_context_menu)
    
    def _update_endpoint_list(self):
        """Update the endpoints list based on current filters."""
        # Clear existing items
        for item in self.endpoints_tree.get_children():
            self.endpoints_tree.delete(item)
        
        # Apply filters
        search_query = self.search_var.get().lower()
        selected_category = self.category_var.get()
        
        self.filtered_endpoints = []
        
        for endpoint in self.endpoints:
            # Apply search filter
            if search_query:
                searchable_text = f"{endpoint.method} {endpoint.path} {endpoint.description}".lower()
                if search_query not in searchable_text:
                    continue
            
            # Apply category filter
            if selected_category != "All":
                endpoint_category = getattr(endpoint, 'category', 'General')
                if endpoint_category != selected_category:
                    continue
            
            self.filtered_endpoints.append(endpoint)
        
        # Populate treeview
        for i, endpoint in enumerate(self.filtered_endpoints, 1):
            # Color code by HTTP method
            method_colors = {
                'GET': 'blue',
                'POST': 'green',
                'PUT': 'orange',
                'PATCH': 'purple',
                'DELETE': 'red'
            }
            
            item_id = self.endpoints_tree.insert(
                '',
                'end',
                text=str(i),
                values=(endpoint.method, endpoint.path, endpoint.description),
                tags=(endpoint.method.lower(),)
            )
            
            # Configure method color
            method_color = method_colors.get(endpoint.method, 'black')
            self.endpoints_tree.set(item_id, 'method', endpoint.method)
        
        # Configure method colors
        for method, color in method_colors.items():
            self.endpoints_tree.tag_configure(method.lower(), foreground=color)
        
        # Update status
        total_count = len(self.endpoints)
        filtered_count = len(self.filtered_endpoints)
        
        if filtered_count == total_count:
            status_text = f"Showing {total_count} endpoints for {self.service_name}"
        else:
            status_text = f"Showing {filtered_count} of {total_count} endpoints for {self.service_name}"
        
        self.status_label.configure(text=status_text)
    
    def _on_filter_change(self, *args):
        """Handle filter changes."""
        self._update_endpoint_list()
        self._clear_selection()
    
    def _clear_filters(self):
        """Clear all filters."""
        self.search_var.set("")
        self.category_var.set("All")
    
    def _on_tree_selection(self, event):
        """Handle treeview selection."""
        selection = self.endpoints_tree.selection()
        if not selection:
            self._clear_selection()
            return
        
        # Get selected endpoint
        item = selection[0]
        item_index = int(self.endpoints_tree.item(item, 'text')) - 1
        
        if 0 <= item_index < len(self.filtered_endpoints):
            self.selected_endpoint = self.filtered_endpoints[item_index]
            self._update_endpoint_details()
            self._enable_action_buttons()
    
    def _on_tree_double_click(self, event):
        """Handle double-click on treeview item."""
        if self.selected_endpoint:
            self._on_select_endpoint()
    
    def _clear_selection(self):
        """Clear current selection."""
        self.selected_endpoint = None
        self._clear_endpoint_details()
        self._disable_action_buttons()
    
    def _update_endpoint_details(self):
        """Update the endpoint details display."""
        if not self.selected_endpoint:
            return
        
        endpoint = self.selected_endpoint
        
        # Build details text
        details = []
        details.append(f"Method: {endpoint.method}")
        details.append(f"Path: {endpoint.path}")
        details.append(f"Description: {endpoint.description}")
        
        # Add category if available
        if hasattr(endpoint, 'category'):
            details.append(f"Category: {endpoint.category}")
        
        # Add parameters if available
        if hasattr(endpoint, 'parameters') and endpoint.parameters:
            details.append("\nParameters:")
            for param, desc in endpoint.parameters.items():
                details.append(f"  • {param}: {desc}")
        
        # Add headers if available
        if hasattr(endpoint, 'headers') and endpoint.headers:
            details.append("\nHeaders:")
            for header, value in endpoint.headers.items():
                details.append(f"  • {header}: {value}")
        
        # Add sample payload if available
        if endpoint.sample_payload:
            details.append("\nSample Payload:")
            try:
                payload_json = json.dumps(endpoint.sample_payload, indent=2)
                details.append(payload_json)
            except Exception:
                details.append(str(endpoint.sample_payload))
        
        # Add expected response if available
        if hasattr(endpoint, 'expected_response') and endpoint.expected_response:
            details.append("\nExpected Response:")
            try:
                response_json = json.dumps(endpoint.expected_response, indent=2)
                details.append(response_json)
            except Exception:
                details.append(str(endpoint.expected_response))
        
        # Add tags if available
        if hasattr(endpoint, 'tags') and endpoint.tags:
            details.append(f"\nTags: {', '.join(endpoint.tags)}")
        
        # Update details text
        self.details_text.configure(state=tk.NORMAL)
        self.details_text.delete('1.0', tk.END)
        self.details_text.insert('1.0', '\n'.join(details))
        self.details_text.configure(state=tk.DISABLED)
    
    def _clear_endpoint_details(self):
        """Clear the endpoint details display."""
        self.details_text.configure(state=tk.NORMAL)
        self.details_text.delete('1.0', tk.END)
        self.details_text.insert('1.0', "Select an endpoint to view details")
        self.details_text.configure(state=tk.DISABLED)
    
    def _enable_action_buttons(self):
        """Enable action buttons."""
        self.select_button.configure(state='normal')
        self.execute_button.configure(state='normal')
        self.copy_button.configure(state='normal')
    
    def _disable_action_buttons(self):
        """Disable action buttons."""
        self.select_button.configure(state='disabled')
        self.execute_button.configure(state='disabled')
        self.copy_button.configure(state='disabled')
    
    def _on_select_endpoint(self):
        """Handle select endpoint button click."""
        if self.selected_endpoint and self.on_endpoint_selected:
            self.on_endpoint_selected(self.selected_endpoint)
    
    def _on_execute_endpoint(self):
        """Handle execute endpoint button click."""
        if self.selected_endpoint and self.on_endpoint_executed:
            self.on_endpoint_executed(self.selected_endpoint)
    
    def _on_copy_details(self):
        """Handle copy details button click."""
        if not self.selected_endpoint:
            return
        
        try:
            details_text = self.details_text.get('1.0', tk.END)
            self.clipboard_clear()
            self.clipboard_append(details_text)
            
            # Show brief confirmation
            original_text = self.copy_button.cget('text')
            self.copy_button.configure(text='Copied!')
            self.after(1500, lambda: self.copy_button.configure(text=original_text))
            
        except Exception as e:
            messagebox.showerror("Copy Error", f"Failed to copy details: {str(e)}")
    
    def _show_context_menu(self, event):
        """Show context menu for treeview."""
        # Select item under cursor
        item = self.endpoints_tree.identify_row(event.y)
        if item:
            self.endpoints_tree.selection_set(item)
            self._on_tree_selection(None)
            
            # Create context menu
            context_menu = tk.Menu(self, tearoff=0)
            context_menu.add_command(
                label="Select Endpoint",
                command=self._on_select_endpoint,
                state='normal' if self.selected_endpoint else 'disabled'
            )
            context_menu.add_command(
                label="Execute Now",
                command=self._on_execute_endpoint,
                state='normal' if self.selected_endpoint else 'disabled'
            )
            context_menu.add_separator()
            context_menu.add_command(
                label="Copy Details",
                command=self._on_copy_details,
                state='normal' if self.selected_endpoint else 'disabled'
            )
            
            # Show menu
            try:
                context_menu.tk_popup(event.x_root, event.y_root)
            finally:
                context_menu.grab_release()
    
    def update_endpoints(self, endpoints: List[EndpointInfo]):
        """
        Update the endpoints list.
        
        Args:
            endpoints: New list of endpoints
        """
        self.endpoints = endpoints
        self.filtered_endpoints = endpoints.copy()
        self._extract_categories()
        self.category_combo.configure(values=self.categories)
        self._update_endpoint_list()
        self._clear_selection()
    
    def get_selected_endpoint(self) -> Optional[EndpointInfo]:
        """
        Get the currently selected endpoint.
        
        Returns:
            Selected EndpointInfo or None
        """
        return self.selected_endpoint
    
    def select_endpoint_by_path(self, method: str, path: str) -> bool:
        """
        Select an endpoint by method and path.
        
        Args:
            method: HTTP method
            path: Endpoint path
            
        Returns:
            True if endpoint was found and selected, False otherwise
        """
        for i, endpoint in enumerate(self.filtered_endpoints):
            if endpoint.method.upper() == method.upper() and endpoint.path == path:
                # Select the item in treeview
                items = self.endpoints_tree.get_children()
                if i < len(items):
                    self.endpoints_tree.selection_set(items[i])
                    self.endpoints_tree.focus(items[i])
                    self._on_tree_selection(None)
                    return True
        
        return False