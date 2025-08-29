"""
JSON viewer component for formatted display of API responses.
Provides syntax highlighting, collapsible sections, and copy functionality.
"""
import tkinter as tk
from tkinter import ttk, messagebox
import json
from typing import Any, Dict, Optional, Union
import re


class JsonViewer(ttk.Frame):
    """
    JSON viewer component with syntax highlighting and interactive features.
    
    Displays JSON data with proper formatting, syntax highlighting,
    and provides functionality to copy content and expand/collapse sections.
    """
    
    # Color scheme for JSON syntax highlighting
    COLORS = {
        'string': '#d73a49',      # Red for strings
        'number': '#005cc5',      # Blue for numbers
        'boolean': '#e36209',     # Orange for booleans
        'null': '#6f42c1',        # Purple for null
        'key': '#032f62',         # Dark blue for keys
        'brace': '#24292e',       # Dark gray for braces/brackets
        'background': '#ffffff',   # White background
        'text': '#24292e'         # Dark gray for regular text
    }
    
    def __init__(
        self,
        parent,
        width: int = 80,
        height: int = 20,
        show_line_numbers: bool = True,
        enable_copy: bool = True,
        **kwargs
    ):
        """
        Initialize JSON viewer.
        
        Args:
            parent: Parent widget
            width: Width of the text widget in characters
            height: Height of the text widget in lines
            show_line_numbers: Whether to show line numbers
            enable_copy: Whether to enable copy functionality
            **kwargs: Additional arguments for ttk.Frame
        """
        super().__init__(parent, **kwargs)
        
        self.width = width
        self.height = height
        self.show_line_numbers = show_line_numbers
        self.enable_copy = enable_copy
        
        # Current JSON data
        self._json_data: Optional[Any] = None
        self._formatted_json: str = ""
        
        # Create UI elements
        self._create_widgets()
        self._setup_layout()
        self._setup_bindings()
        self._configure_tags()
    
    def _create_widgets(self):
        """Create the UI widgets for the JSON viewer."""
        # Main container frame
        self.main_frame = ttk.Frame(self)
        
        # Toolbar frame
        self.toolbar_frame = ttk.Frame(self.main_frame)
        
        # Copy button
        if self.enable_copy:
            self.copy_button = ttk.Button(
                self.toolbar_frame,
                text="Copy JSON",
                command=self._copy_json,
                width=12
            )
        
        # Clear button
        self.clear_button = ttk.Button(
            self.toolbar_frame,
            text="Clear",
            command=self.clear,
            width=8
        )
        
        # Format button
        self.format_button = ttk.Button(
            self.toolbar_frame,
            text="Reformat",
            command=self._reformat_json,
            width=10
        )
        
        # Text widget container with scrollbars
        self.text_frame = ttk.Frame(self.main_frame)
        
        # Line numbers text widget (optional)
        if self.show_line_numbers:
            self.line_numbers = tk.Text(
                self.text_frame,
                width=4,
                height=self.height,
                wrap=tk.NONE,
                state=tk.DISABLED,
                bg='#f6f8fa',
                fg='#586069',
                font=('Consolas', 10),
                relief=tk.FLAT,
                borderwidth=0,
                selectbackground='#f6f8fa',
                selectforeground='#586069'
            )
        
        # Main text widget for JSON content
        self.text_widget = tk.Text(
            self.text_frame,
            width=self.width,
            height=self.height,
            wrap=tk.NONE,
            font=('Consolas', 10),
            bg=self.COLORS['background'],
            fg=self.COLORS['text'],
            selectbackground='#0366d6',
            selectforeground='white',
            insertbackground='#24292e',
            relief=tk.FLAT,
            borderwidth=1
        )
        
        # Scrollbars
        self.v_scrollbar = ttk.Scrollbar(
            self.text_frame,
            orient=tk.VERTICAL,
            command=self._on_scroll_vertical
        )
        
        self.h_scrollbar = ttk.Scrollbar(
            self.text_frame,
            orient=tk.HORIZONTAL,
            command=self.text_widget.xview
        )
        
        # Configure scrollbar commands
        self.text_widget.configure(
            yscrollcommand=self._on_text_scroll_vertical,
            xscrollcommand=self.h_scrollbar.set
        )
        
        if self.show_line_numbers:
            self.line_numbers.configure(yscrollcommand=self._on_line_numbers_scroll)
    
    def _setup_layout(self):
        """Set up the layout of widgets."""
        # Configure grid weights
        self.columnconfigure(0, weight=1)
        self.rowconfigure(0, weight=1)
        
        self.main_frame.columnconfigure(0, weight=1)
        self.main_frame.rowconfigure(1, weight=1)
        
        self.text_frame.columnconfigure(1 if self.show_line_numbers else 0, weight=1)
        self.text_frame.rowconfigure(0, weight=1)
        
        # Place main frame
        self.main_frame.grid(row=0, column=0, sticky='nsew', padx=5, pady=5)
        
        # Place toolbar
        self.toolbar_frame.grid(row=0, column=0, sticky='ew', pady=(0, 5))
        
        # Place toolbar buttons
        col = 0
        if self.enable_copy:
            self.copy_button.grid(row=0, column=col, padx=(0, 5))
            col += 1
        
        self.clear_button.grid(row=0, column=col, padx=(0, 5))
        col += 1
        
        self.format_button.grid(row=0, column=col, padx=(0, 5))
        
        # Place text frame
        self.text_frame.grid(row=1, column=0, sticky='nsew')
        
        # Place text widgets and scrollbars
        if self.show_line_numbers:
            self.line_numbers.grid(row=0, column=0, sticky='ns')
            self.text_widget.grid(row=0, column=1, sticky='nsew')
            self.v_scrollbar.grid(row=0, column=2, sticky='ns')
        else:
            self.text_widget.grid(row=0, column=0, sticky='nsew')
            self.v_scrollbar.grid(row=0, column=1, sticky='ns')
        
        self.h_scrollbar.grid(
            row=1, 
            column=1 if self.show_line_numbers else 0, 
            sticky='ew'
        )
    
    def _setup_bindings(self):
        """Set up event bindings."""
        # Prevent editing of the text widget
        self.text_widget.bind("<Key>", lambda e: "break")
        self.text_widget.bind("<Button-1>", self._on_text_click)
        
        # Context menu
        self.text_widget.bind("<Button-3>", self._show_context_menu)
        
        # Synchronize line numbers scrolling
        if self.show_line_numbers:
            self.line_numbers.bind("<Key>", lambda e: "break")
            self.line_numbers.bind("<Button-1>", lambda e: "break")
    
    def _configure_tags(self):
        """Configure text tags for syntax highlighting."""
        # Configure color tags
        for tag_name, color in self.COLORS.items():
            if tag_name not in ['background', 'text']:
                self.text_widget.tag_configure(tag_name, foreground=color)
        
        # Special formatting tags
        self.text_widget.tag_configure('bold', font=('Consolas', 10, 'bold'))
        self.text_widget.tag_configure('italic', font=('Consolas', 10, 'italic'))
    
    def _on_scroll_vertical(self, *args):
        """Handle vertical scrolling for both text widgets."""
        self.text_widget.yview(*args)
        if self.show_line_numbers:
            self.line_numbers.yview(*args)
    
    def _on_text_scroll_vertical(self, *args):
        """Handle text widget vertical scroll events."""
        self.v_scrollbar.set(*args)
        if self.show_line_numbers:
            self.line_numbers.yview_moveto(args[0])
    
    def _on_line_numbers_scroll(self, *args):
        """Handle line numbers scroll events."""
        self.v_scrollbar.set(*args)
    
    def _on_text_click(self, event):
        """Handle text widget click events."""
        # Allow text selection but prevent cursor placement
        return None
    
    def _show_context_menu(self, event):
        """Show context menu with copy options."""
        if not self.enable_copy:
            return
        
        context_menu = tk.Menu(self, tearoff=0)
        context_menu.add_command(label="Copy All", command=self._copy_json)
        context_menu.add_command(label="Copy Selection", command=self._copy_selection)
        
        try:
            context_menu.tk_popup(event.x_root, event.y_root)
        finally:
            context_menu.grab_release()
    
    def _copy_json(self):
        """Copy the entire JSON content to clipboard."""
        if self._formatted_json:
            self.clipboard_clear()
            self.clipboard_append(self._formatted_json)
            messagebox.showinfo("Copied", "JSON content copied to clipboard")
    
    def _copy_selection(self):
        """Copy selected text to clipboard."""
        try:
            selected_text = self.text_widget.selection_get()
            if selected_text:
                self.clipboard_clear()
                self.clipboard_append(selected_text)
                messagebox.showinfo("Copied", "Selected text copied to clipboard")
        except tk.TclError:
            messagebox.showwarning("No Selection", "No text selected")
    
    def _reformat_json(self):
        """Reformat the current JSON with proper indentation."""
        if self._json_data is not None:
            self.display_json(self._json_data)
    
    def _update_line_numbers(self):
        """Update line numbers display."""
        if not self.show_line_numbers:
            return
        
        # Count lines in text widget
        line_count = int(self.text_widget.index('end-1c').split('.')[0])
        
        # Generate line numbers
        line_numbers_text = '\n'.join(str(i) for i in range(1, line_count))
        
        # Update line numbers widget
        self.line_numbers.configure(state=tk.NORMAL)
        self.line_numbers.delete('1.0', tk.END)
        self.line_numbers.insert('1.0', line_numbers_text)
        self.line_numbers.configure(state=tk.DISABLED)
    
    def display_json(self, data: Any, title: Optional[str] = None):
        """
        Display JSON data with syntax highlighting.
        
        Args:
            data: JSON data to display (dict, list, or any JSON-serializable object)
            title: Optional title to display above the JSON
        """
        self._json_data = data
        
        try:
            # Format JSON with proper indentation
            if isinstance(data, str):
                # Try to parse if it's a JSON string
                try:
                    parsed_data = json.loads(data)
                    self._formatted_json = json.dumps(parsed_data, indent=2, ensure_ascii=False)
                except json.JSONDecodeError:
                    # If not valid JSON, display as plain text
                    self._formatted_json = data
            else:
                self._formatted_json = json.dumps(data, indent=2, ensure_ascii=False)
        
        except (TypeError, ValueError) as e:
            # Handle non-serializable objects
            self._formatted_json = f"Error formatting JSON: {str(e)}\n\nRaw data:\n{str(data)}"
        
        # Clear existing content
        self.text_widget.configure(state=tk.NORMAL)
        self.text_widget.delete('1.0', tk.END)
        
        # Add title if provided
        if title:
            self.text_widget.insert(tk.END, f"=== {title} ===\n\n", 'bold')
        
        # Insert formatted JSON
        self.text_widget.insert(tk.END, self._formatted_json)
        
        # Apply syntax highlighting
        self._apply_syntax_highlighting()
        
        # Update line numbers
        self._update_line_numbers()
        
        # Make text widget read-only
        self.text_widget.configure(state=tk.DISABLED)
        
        # Scroll to top
        self.text_widget.see('1.0')
    
    def _apply_syntax_highlighting(self):
        """Apply syntax highlighting to the JSON content."""
        content = self.text_widget.get('1.0', tk.END)
        
        # Remove existing tags
        for tag in ['string', 'number', 'boolean', 'null', 'key', 'brace']:
            self.text_widget.tag_remove(tag, '1.0', tk.END)
        
        # Patterns for different JSON elements
        patterns = [
            (r'"[^"]*"(?=\s*:)', 'key'),        # Keys (strings followed by colon)
            (r'"[^"]*"(?!\s*:)', 'string'),     # String values (not followed by colon)
            (r'\b-?\d+\.?\d*\b', 'number'),     # Numbers
            (r'\b(true|false)\b', 'boolean'),   # Booleans
            (r'\bnull\b', 'null'),              # Null values
            (r'[{}\[\],]', 'brace'),            # Braces, brackets, commas
        ]
        
        # Apply highlighting for each pattern
        for pattern, tag in patterns:
            for match in re.finditer(pattern, content):
                start_line = content[:match.start()].count('\n') + 1
                start_col = match.start() - content.rfind('\n', 0, match.start()) - 1
                end_line = content[:match.end()].count('\n') + 1
                end_col = match.end() - content.rfind('\n', 0, match.end()) - 1
                
                start_index = f"{start_line}.{start_col}"
                end_index = f"{end_line}.{end_col}"
                
                self.text_widget.tag_add(tag, start_index, end_index)
    
    def display_error(self, error_message: str, error_details: Optional[str] = None):
        """
        Display error message in the viewer.
        
        Args:
            error_message: Main error message
            error_details: Optional detailed error information
        """
        self.text_widget.configure(state=tk.NORMAL)
        self.text_widget.delete('1.0', tk.END)
        
        # Insert error message
        self.text_widget.insert(tk.END, "ERROR\n", 'bold')
        self.text_widget.insert(tk.END, f"{error_message}\n")
        
        if error_details:
            self.text_widget.insert(tk.END, f"\nDetails:\n{error_details}")
        
        # Configure error text color
        self.text_widget.tag_configure('error', foreground='#d73a49')
        self.text_widget.tag_add('error', '2.0', tk.END)
        
        self._update_line_numbers()
        self.text_widget.configure(state=tk.DISABLED)
        self.text_widget.see('1.0')
    
    def display_plain_text(self, text: str, title: Optional[str] = None):
        """
        Display plain text content.
        
        Args:
            text: Plain text to display
            title: Optional title
        """
        self.text_widget.configure(state=tk.NORMAL)
        self.text_widget.delete('1.0', tk.END)
        
        if title:
            self.text_widget.insert(tk.END, f"=== {title} ===\n\n", 'bold')
        
        self.text_widget.insert(tk.END, text)
        
        self._update_line_numbers()
        self.text_widget.configure(state=tk.DISABLED)
        self.text_widget.see('1.0')
    
    def clear(self):
        """Clear the JSON viewer content."""
        self._json_data = None
        self._formatted_json = ""
        
        self.text_widget.configure(state=tk.NORMAL)
        self.text_widget.delete('1.0', tk.END)
        self.text_widget.configure(state=tk.DISABLED)
        
        if self.show_line_numbers:
            self.line_numbers.configure(state=tk.NORMAL)
            self.line_numbers.delete('1.0', tk.END)
            self.line_numbers.configure(state=tk.DISABLED)
    
    def get_content(self) -> str:
        """
        Get the current content of the viewer.
        
        Returns:
            Current text content
        """
        return self.text_widget.get('1.0', tk.END).rstrip('\n')
    
    def get_json_data(self) -> Any:
        """
        Get the current JSON data object.
        
        Returns:
            Current JSON data or None
        """
        return self._json_data
    
    def set_font_size(self, size: int):
        """
        Set the font size for the text display.
        
        Args:
            size: Font size in points
        """
        font = ('Consolas', size)
        self.text_widget.configure(font=font)
        if self.show_line_numbers:
            self.line_numbers.configure(font=font)