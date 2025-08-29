"""
Keyboard shortcuts and accessibility features for MCP Dashboard GUI.
Provides comprehensive keyboard navigation and accessibility support.
"""
import tkinter as tk
from tkinter import messagebox
from typing import Dict, Callable, Optional, Any
import logging


class KeyboardShortcutManager:
    """
    Manages keyboard shortcuts and accessibility features.
    Provides centralized keyboard event handling and navigation.
    """
    
    def __init__(self, root: tk.Tk, main_window=None):
        """
        Initialize keyboard shortcut manager.
        
        Args:
            root: Root Tk window
            main_window: Main window instance for callbacks
        """
        self.root = root
        self.main_window = main_window
        self.logger = logging.getLogger("KeyboardShortcuts")
        
        # Shortcut registry
        self.shortcuts: Dict[str, Dict[str, Any]] = {}
        
        # Focus management
        self.focus_history = []
        self.current_focus_index = -1
        
        # Setup shortcuts
        self._register_default_shortcuts()
        self._bind_shortcuts()
        
        # Setup accessibility features
        self._setup_accessibility()
    
    def _register_default_shortcuts(self):
        """Register default keyboard shortcuts."""
        # Application shortcuts
        self.register_shortcut(
            'Control-q', 
            'Quit Application',
            self._quit_application,
            'Application'
        )
        
        self.register_shortcut(
            'Alt-F4', 
            'Quit Application',
            self._quit_application,
            'Application'
        )
        
        # Navigation shortcuts
        self.register_shortcut(
            'Control-r', 
            'Refresh Services',
            self._refresh_services,
            'Navigation'
        )
        
        self.register_shortcut(
            'F5', 
            'Refresh Services',
            self._refresh_services,
            'Navigation'
        )
        
        self.register_shortcut(
            'Control-h', 
            'Force Health Check All',
            self._force_health_check_all,
            'Health'
        )
        
        self.register_shortcut(
            'F6', 
            'Force Health Check All',
            self._force_health_check_all,
            'Health'
        )
        
        # Service navigation
        self.register_shortcut(
            'Control-1', 
            'Select First Service',
            lambda: self._select_service_by_index(0),
            'Service Navigation'
        )
        
        self.register_shortcut(
            'Control-2', 
            'Select Second Service',
            lambda: self._select_service_by_index(1),
            'Service Navigation'
        )
        
        self.register_shortcut(
            'Control-3', 
            'Select Third Service',
            lambda: self._select_service_by_index(2),
            'Service Navigation'
        )