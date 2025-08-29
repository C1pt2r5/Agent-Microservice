"""
Centralized styling system for MCP Dashboard GUI.
Provides consistent colors, fonts, and styling across all UI components.
"""
import tkinter as tk
from tkinter import ttk
from typing import Dict, Any, Optional
import sys
import os


class MCPTheme:
    """
    Centralized theme configuration for MCP Dashboard.
    Provides consistent colors, fonts, and styling definitions.
    """
    
    # Color palette - Professional blue/gray theme
    COLORS = {
        # Primary colors
        'primary': '#0366d6',           # GitHub blue
        'primary_dark': '#044289',      # Darker blue
        'primary_light': '#4285f4',     # Lighter blue
        
        # Status colors
        'success': '#28a745',           # Green
        'warning': '#ffc107',           # Yellow/Orange
        'danger': '#dc3545',            # Red
        'info': '#17a2b8',              # Cyan
        
        # Neutral colors
        'white': '#ffffff',
        'light_gray': '#f8f9fa',
        'gray': '#6c757d',
        'dark_gray': '#495057',
        'black': '#212529',
        
        # Background colors
        'bg_primary': '#ffffff',
        'bg_secondary': '#f8f9fa',
        'bg_tertiary': '#e9ecef',
        'bg_dark': '#343a40',
        
        # Border colors
        'border_light': '#dee2e6',
        'border_medium': '#ced4da',
        'border_dark': '#6c757d',
        
        # Text colors
        'text_primary': '#212529',
        'text_secondary': '#6c757d',
        'text_muted': '#868e96',
        'text_white': '#ffffff',
        
        # Interactive colors
        'hover': '#e9ecef',
        'active': '#dee2e6',
        'focus': '#80bdff',
        'disabled': '#e9ecef',
        
        # Service status colors
        'status_healthy': '#28a745',
        'status_unhealthy': '#dc3545',
        'status_unknown': '#6c757d',
        'status_checking': '#ffc107',
        
        # JSON syntax highlighting
        'json_string': '#d73a49',
        'json_number': '#005cc5',
        'json_boolean': '#e36209',
        'json_null': '#6f42c1',
        'json_key': '#032f62',
        'json_brace': '#24292e',
    }
    
    # Font configuration
    FONTS = {
        # System fonts with fallbacks
        'default': ('Segoe UI', 9),
        'heading': ('Segoe UI', 12, 'bold'),
        'subheading': ('Segoe UI', 10, 'bold'),
        'body': ('Segoe UI', 9),
        'small': ('Segoe UI', 8),
        'code': ('Consolas', 9),
        'code_small': ('Consolas', 8),
        
        # Special purpose fonts
        'title': ('Segoe UI', 18, 'bold'),
        'button': ('Segoe UI', 9),
        'label': ('Segoe UI', 9),
        'status': ('Segoe UI', 8),
    }
    
    # Spacing and sizing
    SPACING = {
        'xs': 2,
        'sm': 5,
        'md': 10,
        'lg': 15,
        'xl': 20,
        'xxl': 30,
    }
    
    # Window sizing
    WINDOW = {
        'min_width': 1000,
        'min_height': 700,
        'default_width': 1400,
        'default_height': 900,
        'sidebar_width': 280,
        'footer_height': 80,
    }
    
    # Component sizing
    COMPONENTS = {
        'button_height': 32,
        'input_height': 28,
        'status_indicator_size': 16,
        'icon_size': 16,
        'toolbar_height': 40,
    }


class StyleManager:
    """
    Manages application-wide styling and theme application.
    Provides methods to apply consistent styling to widgets.
    """
    
    def __init__(self, root: tk.Tk):
        """
        Initialize style manager.
        
        Args:
            root: Root Tk window
        """
        self.root = root
        self.style = ttk.Style()
        self.theme = MCPTheme()
        
        # Configure ttk styles
        self._configure_ttk_styles()
        
        # Set up custom styles
        self._setup_custom_styles()
    
    def _configure_ttk_styles(self):
        """Configure ttk widget styles."""
        # Use a modern theme as base
        available_themes = self.style.theme_names()
        
        if 'vista' in available_themes:
            self.style.theme_use('vista')
        elif 'clam' in available_themes:
            self.style.theme_use('clam')
        else:
            self.style.theme_use('default')
        
        # Configure button styles
        self.style.configure(
            'TButton',
            font=self.theme.FONTS['button'],
            padding=(12, 6),
            relief='flat',
            borderwidth=1
        )
        
        self.style.map(
            'TButton',
            background=[
                ('active', self.theme.COLORS['hover']),
                ('pressed', self.theme.COLORS['active']),
                ('disabled', self.theme.COLORS['disabled'])
            ],
            bordercolor=[
                ('focus', self.theme.COLORS['focus']),
                ('!focus', self.theme.COLORS['border_medium'])
            ]
        )
        
        # Primary button style
        self.style.configure(
            'Primary.TButton',
            background=self.theme.COLORS['primary'],
            foreground=self.theme.COLORS['text_white'],
            font=self.theme.FONTS['button']
        )
        
        self.style.map(
            'Primary.TButton',
            background=[
                ('active', self.theme.COLORS['primary_dark']),
                ('pressed', self.theme.COLORS['primary_dark']),
                ('disabled', self.theme.COLORS['disabled'])
            ]
        )
        
        # Success button style
        self.style.configure(
            'Success.TButton',
            background=self.theme.COLORS['success'],
            foreground=self.theme.COLORS['text_white']
        )
        
        # Warning button style
        self.style.configure(
            'Warning.TButton',
            background=self.theme.COLORS['warning'],
            foreground=self.theme.COLORS['text_primary']
        )
        
        # Danger button style
        self.style.configure(
            'Danger.TButton',
            background=self.theme.COLORS['danger'],
            foreground=self.theme.COLORS['text_white']
        )
        
        # Accent button style (for selected items)
        self.style.configure(
            'Accent.TButton',
            background=self.theme.COLORS['primary_light'],
            foreground=self.theme.COLORS['text_white'],
            relief='solid',
            borderwidth=2,
            bordercolor=self.theme.COLORS['primary']
        )
        
        # Configure frame styles
        self.style.configure(
            'Card.TFrame',
            background=self.theme.COLORS['bg_primary'],
            relief='solid',
            borderwidth=1,
            bordercolor=self.theme.COLORS['border_light']
        )
        
        self.style.configure(
            'Sidebar.TFrame',
            background=self.theme.COLORS['bg_secondary'],
            relief='solid',
            borderwidth=1,
            bordercolor=self.theme.COLORS['border_light']
        )
        
        # Configure label styles
        self.style.configure(
            'Heading.TLabel',
            font=self.theme.FONTS['heading'],
            foreground=self.theme.COLORS['text_primary']
        )
        
        self.style.configure(
            'Subheading.TLabel',
            font=self.theme.FONTS['subheading'],
            foreground=self.theme.COLORS['text_primary']
        )
        
        self.style.configure(
            'Body.TLabel',
            font=self.theme.FONTS['body'],
            foreground=self.theme.COLORS['text_primary']
        )
        
        self.style.configure(
            'Muted.TLabel',
            font=self.theme.FONTS['body'],
            foreground=self.theme.COLORS['text_muted']
        )
        
        self.style.configure(
            'Status.TLabel',
            font=self.theme.FONTS['status'],
            foreground=self.theme.COLORS['text_secondary']
        )
        
        # Configure entry styles
        self.style.configure(
            'TEntry',
            font=self.theme.FONTS['body'],
            fieldbackground=self.theme.COLORS['bg_primary'],
            bordercolor=self.theme.COLORS['border_medium'],
            insertcolor=self.theme.COLORS['text_primary']
        )
        
        self.style.map(
            'TEntry',
            bordercolor=[
                ('focus', self.theme.COLORS['focus']),
                ('!focus', self.theme.COLORS['border_medium'])
            ]
        )
        
        # Configure notebook (tab) styles
        self.style.configure(
            'TNotebook',
            background=self.theme.COLORS['bg_secondary'],
            borderwidth=0
        )
        
        self.style.configure(
            'TNotebook.Tab',
            font=self.theme.FONTS['body'],
            padding=(12, 8),
            background=self.theme.COLORS['bg_tertiary'],
            foreground=self.theme.COLORS['text_secondary']
        )
        
        self.style.map(
            'TNotebook.Tab',
            background=[
                ('selected', self.theme.COLORS['bg_primary']),
                ('active', self.theme.COLORS['hover'])
            ],
            foreground=[
                ('selected', self.theme.COLORS['text_primary']),
                ('active', self.theme.COLORS['text_primary'])
            ]
        )
        
        # Configure treeview styles
        self.style.configure(
            'Treeview',
            font=self.theme.FONTS['body'],
            background=self.theme.COLORS['bg_primary'],
            foreground=self.theme.COLORS['text_primary'],
            fieldbackground=self.theme.COLORS['bg_primary'],
            borderwidth=1,
            relief='solid'
        )
        
        self.style.configure(
            'Treeview.Heading',
            font=self.theme.FONTS['subheading'],
            background=self.theme.COLORS['bg_secondary'],
            foreground=self.theme.COLORS['text_primary'],
            relief='flat'
        )
        
        # Configure progressbar styles
        self.style.configure(
            'TProgressbar',
            background=self.theme.COLORS['primary'],
            troughcolor=self.theme.COLORS['bg_tertiary'],
            borderwidth=0,
            lightcolor=self.theme.COLORS['primary'],
            darkcolor=self.theme.COLORS['primary']
        )
    
    def _setup_custom_styles(self):
        """Set up custom widget styles not covered by ttk."""
        # Configure root window
        self.root.configure(bg=self.theme.COLORS['bg_secondary'])
        
        # Set default font for tk widgets
        self.root.option_add('*Font', self.theme.FONTS['default'])
    
    def apply_card_style(self, frame: ttk.Frame):
        """
        Apply card-like styling to a frame.
        
        Args:
            frame: Frame to style
        """
        frame.configure(style='Card.TFrame')
    
    def apply_sidebar_style(self, frame: ttk.Frame):
        """
        Apply sidebar styling to a frame.
        
        Args:
            frame: Frame to style
        """
        frame.configure(style='Sidebar.TFrame')
    
    def create_styled_text_widget(
        self, 
        parent, 
        width: int = 80, 
        height: int = 20,
        font_type: str = 'code',
        **kwargs
    ) -> tk.Text:
        """
        Create a styled text widget.
        
        Args:
            parent: Parent widget
            width: Width in characters
            height: Height in lines
            font_type: Font type from theme
            **kwargs: Additional Text widget arguments
            
        Returns:
            Configured Text widget
        """
        defaults = {
            'font': self.theme.FONTS.get(font_type, self.theme.FONTS['code']),
            'bg': self.theme.COLORS['bg_primary'],
            'fg': self.theme.COLORS['text_primary'],
            'selectbackground': self.theme.COLORS['primary'],
            'selectforeground': self.theme.COLORS['text_white'],
            'insertbackground': self.theme.COLORS['text_primary'],
            'relief': 'solid',
            'borderwidth': 1,
            'highlightcolor': self.theme.COLORS['focus'],
            'highlightbackground': self.theme.COLORS['border_medium'],
            'highlightthickness': 1,
            'wrap': tk.WORD,
            'width': width,
            'height': height
        }
        
        # Merge with provided kwargs
        defaults.update(kwargs)
        
        return tk.Text(parent, **defaults)
    
    def create_styled_canvas(
        self, 
        parent, 
        width: int = 100, 
        height: int = 100,
        **kwargs
    ) -> tk.Canvas:
        """
        Create a styled canvas widget.
        
        Args:
            parent: Parent widget
            width: Canvas width
            height: Canvas height
            **kwargs: Additional Canvas arguments
            
        Returns:
            Configured Canvas widget
        """
        defaults = {
            'bg': self.theme.COLORS['bg_primary'],
            'highlightthickness': 0,
            'relief': 'flat',
            'width': width,
            'height': height
        }
        
        defaults.update(kwargs)
        return tk.Canvas(parent, **defaults)
    
    def get_color(self, color_name: str) -> str:
        """
        Get color value by name.
        
        Args:
            color_name: Name of the color
            
        Returns:
            Color hex value
        """
        return self.theme.COLORS.get(color_name, '#000000')
    
    def get_font(self, font_name: str) -> tuple:
        """
        Get font configuration by name.
        
        Args:
            font_name: Name of the font
            
        Returns:
            Font tuple (family, size, style)
        """
        return self.theme.FONTS.get(font_name, self.theme.FONTS['default'])
    
    def get_spacing(self, size: str) -> int:
        """
        Get spacing value by size name.
        
        Args:
            size: Size name (xs, sm, md, lg, xl, xxl)
            
        Returns:
            Spacing value in pixels
        """
        return self.theme.SPACING.get(size, 10)


def apply_global_styles(root: tk.Tk) -> StyleManager:
    """
    Apply global styles to the application.
    
    Args:
        root: Root Tk window
        
    Returns:
        StyleManager instance
    """
    style_manager = StyleManager(root)
    
    # Configure window properties
    root.configure(bg=style_manager.theme.COLORS['bg_secondary'])
    
    # Set window icon if available
    try:
        # Try to set application icon
        icon_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icon.ico')
        if os.path.exists(icon_path):
            root.iconbitmap(icon_path)
    except Exception:
        # Fallback - no icon
        pass
    
    return style_manager


def create_status_colors() -> Dict[str, str]:
    """
    Create a dictionary of status colors for easy access.
    
    Returns:
        Dictionary mapping status names to colors
    """
    theme = MCPTheme()
    return {
        'healthy': theme.COLORS['status_healthy'],
        'unhealthy': theme.COLORS['status_unhealthy'],
        'unknown': theme.COLORS['status_unknown'],
        'checking': theme.COLORS['status_checking'],
        'success': theme.COLORS['success'],
        'warning': theme.COLORS['warning'],
        'danger': theme.COLORS['danger'],
        'info': theme.COLORS['info']
    }


def create_json_syntax_colors() -> Dict[str, str]:
    """
    Create a dictionary of JSON syntax highlighting colors.
    
    Returns:
        Dictionary mapping JSON element types to colors
    """
    theme = MCPTheme()
    return {
        'string': theme.COLORS['json_string'],
        'number': theme.COLORS['json_number'],
        'boolean': theme.COLORS['json_boolean'],
        'null': theme.COLORS['json_null'],
        'key': theme.COLORS['json_key'],
        'brace': theme.COLORS['json_brace']
    }