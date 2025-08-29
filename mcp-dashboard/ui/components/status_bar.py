"""
Enhanced status bar component for real-time user feedback.
Provides status messages, progress indicators, and error notifications.
"""
import tkinter as tk
from tkinter import ttk
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
import threading
import time


class StatusType(Enum):
    """Types of status messages."""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    PROGRESS = "progress"


class StatusBar(ttk.Frame):
    """
    Enhanced status bar with real-time feedback capabilities.
    
    Features:
    - Different status types with color coding
    - Progress indicators for long operations
    - Message history
    - Auto-clear functionality
    - Thread-safe updates
    """
    
    def __init__(self, parent, **kwargs):
        """
        Initialize status bar.
        
        Args:
            parent: Parent widget
            **kwargs: Additional frame arguments
        """
        super().__init__(parent, **kwargs)
        
        # Configuration
        self.auto_clear_delay = 5000  # 5 seconds
        self.max_message_length = 100
        self.show_timestamp = True
        
        # State
        self.current_message = ""
        self.current_type = StatusType.INFO
        self.message_history = []
        self.max_history = 50
        self.auto_clear_job = None
        self.progress_job = None
        
        # Thread safety
        self._lock = threading.Lock()
        
        # Create UI components
        self._create_widgets()
        
        # Set initial status
        self.set_status("Ready", StatusType.INFO)
    
    def _create_widgets(self):
        """Create status bar widgets."""
        # Configure grid weights
        self.columnconfigure(1, weight=1)
        
        # Status icon/indicator
        self.status_icon = ttk.Label(self, text="●", font=('Segoe UI', 8))
        self.status_icon.grid(row=0, column=0, padx=(5, 2), pady=2, sticky='w')
        
        # Status message label
        self.status_label = ttk.Label(
            self, 
            text="Ready",
            font=('Segoe UI', 8),
            anchor='w'
        )
        self.status_label.grid(row=0, column=1, padx=2, pady=2, sticky='ew')
        
        # Progress bar (initially hidden)
        self.progress_bar = ttk.Progressbar(
            self,
            mode='indeterminate',
            length=100
        )
        # Don't grid initially - will be shown when needed
        
        # Timestamp label
        self.timestamp_label = ttk.Label(
            self,
            text="",
            font=('Segoe UI', 7),
            foreground='gray',
            anchor='e'
        )
        self.timestamp_label.grid(row=0, column=2, padx=(2, 5), pady=2, sticky='e')
        
        # Bind click event for message history
        self.status_label.bind("<Button-1>", self._on_status_click)
        self.status_icon.bind("<Button-1>", self._on_status_click)
    
    def set_status(self, 
                  message: str, 
                  status_type: StatusType = StatusType.INFO,
                  auto_clear: bool = True,
                  show_progress: bool = False):
        """
        Set status message with type and options.
        
        Args:
            message: Status message to display
            status_type: Type of status message
            auto_clear: Whether to auto-clear the message
            show_progress: Whether to show progress indicator
        """
        with self._lock:
            # Truncate long messages
            if len(message) > self.max_message_length:
                message = message[:self.max_message_length - 3] + "..."
            
            # Update state
            self.current_message = message
            self.current_type = status_type
            
            # Add to history
            self._add_to_history(message, status_type)
            
            # Schedule UI update on main thread
            self.after_idle(self._update_ui, message, status_type, show_progress)
            
            # Handle auto-clear
            if auto_clear and status_type != StatusType.PROGRESS:
                self._schedule_auto_clear()
            
            # Handle progress indicator
            if show_progress:
                self._show_progress()
            else:
                self._hide_progress()
    
    def _update_ui(self, message: str, status_type: StatusType, show_progress: bool):
        """Update UI components (must be called on main thread)."""
        try:
            # Update message
            self.status_label.configure(text=message)
            
            # Update icon and colors based on status type
            icon, color = self._get_status_appearance(status_type)
            self.status_icon.configure(text=icon, foreground=color)
            
            # Update timestamp
            if self.show_timestamp:
                timestamp = datetime.now().strftime("%H:%M:%S")
                self.timestamp_label.configure(text=timestamp)
            
            # Handle progress bar
            if show_progress:
                self._show_progress_ui()
            else:
                self._hide_progress_ui()
                
        except tk.TclError:
            # Widget may have been destroyed
            pass
    
    def _get_status_appearance(self, status_type: StatusType) -> tuple:
        """Get icon and color for status type."""
        appearances = {
            StatusType.INFO: ("●", "blue"),
            StatusType.SUCCESS: ("●", "green"),
            StatusType.WARNING: ("●", "orange"),
            StatusType.ERROR: ("●", "red"),
            StatusType.PROGRESS: ("◐", "blue")
        }
        return appearances.get(status_type, ("●", "gray"))
    
    def _add_to_history(self, message: str, status_type: StatusType):
        """Add message to history."""
        history_entry = {
            'message': message,
            'type': status_type,
            'timestamp': datetime.now()
        }
        
        self.message_history.append(history_entry)
        
        # Limit history size
        if len(self.message_history) > self.max_history:
            self.message_history = self.message_history[-self.max_history:]
    
    def _schedule_auto_clear(self):
        """Schedule automatic clearing of status message."""
        # Cancel existing auto-clear job
        if self.auto_clear_job:
            self.after_cancel(self.auto_clear_job)
        
        # Schedule new auto-clear
        self.auto_clear_job = self.after(
            self.auto_clear_delay,
            lambda: self.set_status("Ready", StatusType.INFO, auto_clear=False)
        )
    
    def _show_progress(self):
        """Show progress indicator."""
        if self.progress_job:
            return  # Already showing progress
        
        def animate_progress():
            """Animate progress indicator."""
            try:
                icons = ["◐", "◓", "◑", "◒"]
                icon_index = 0
                
                while self.progress_job:
                    if self.current_type == StatusType.PROGRESS:
                        icon = icons[icon_index % len(icons)]
                        self.after_idle(lambda i=icon: self.status_icon.configure(text=i))
                        icon_index += 1
                    
                    time.sleep(0.2)  # 200ms animation interval
                    
            except Exception:
                pass  # Thread may be interrupted
        
        # Start progress animation in background thread
        self.progress_job = threading.Thread(target=animate_progress, daemon=True)
        self.progress_job.start()
    
    def _show_progress_ui(self):
        """Show progress bar in UI."""
        try:
            # Show progress bar
            self.progress_bar.grid(row=0, column=3, padx=(5, 2), pady=2)
            self.progress_bar.start(10)  # 10ms interval
            
            # Adjust timestamp position
            self.timestamp_label.grid_configure(column=4)
            
        except tk.TclError:
            pass
    
    def _hide_progress(self):
        """Hide progress indicator."""
        if self.progress_job:
            self.progress_job = None  # Signal thread to stop
        
        self.after_idle(self._hide_progress_ui)
    
    def _hide_progress_ui(self):
        """Hide progress bar in UI."""
        try:
            # Hide progress bar
            self.progress_bar.stop()
            self.progress_bar.grid_remove()
            
            # Reset timestamp position
            self.timestamp_label.grid_configure(column=2)
            
        except tk.TclError:
            pass
    
    def set_progress_status(self, message: str, auto_clear: bool = False):
        """
        Set a progress status message.
        
        Args:
            message: Progress message
            auto_clear: Whether to auto-clear when done
        """
        self.set_status(message, StatusType.PROGRESS, auto_clear, show_progress=True)
    
    def set_success_status(self, message: str, auto_clear: bool = True):
        """Set a success status message."""
        self.set_status(message, StatusType.SUCCESS, auto_clear)
    
    def set_warning_status(self, message: str, auto_clear: bool = True):
        """Set a warning status message."""
        self.set_status(message, StatusType.WARNING, auto_clear)
    
    def set_error_status(self, message: str, auto_clear: bool = False):
        """Set an error status message."""
        self.set_status(message, StatusType.ERROR, auto_clear)
    
    def clear_status(self):
        """Clear current status message."""
        self.set_status("Ready", StatusType.INFO, auto_clear=False)
    
    def _on_status_click(self, event):
        """Handle click on status bar to show message history."""
        self._show_history_popup(event)
    
    def _show_history_popup(self, event):
        """Show popup with message history."""
        if not self.message_history:
            return
        
        try:
            # Create popup menu
            popup = tk.Menu(self, tearoff=0)
            
            # Add recent messages (last 10)
            recent_messages = self.message_history[-10:]
            
            for entry in reversed(recent_messages):  # Most recent first
                timestamp = entry['timestamp'].strftime("%H:%M:%S")
                message = entry['message']
                status_type = entry['type']
                
                # Truncate long messages for menu
                if len(message) > 50:
                    message = message[:47] + "..."
                
                # Get status icon
                icon, _ = self._get_status_appearance(status_type)
                
                menu_text = f"{timestamp} {icon} {message}"
                popup.add_command(label=menu_text, state='disabled')
            
            if len(self.message_history) > 10:
                popup.add_separator()
                popup.add_command(
                    label=f"... and {len(self.message_history) - 10} more",
                    state='disabled'
                )
            
            # Show popup
            popup.tk_popup(event.x_root, event.y_root)
            
        except Exception as e:
            # Silently handle popup errors
            pass
        finally:
            try:
                popup.grab_release()
            except:
                pass
    
    def get_current_status(self) -> Dict[str, Any]:
        """
        Get current status information.
        
        Returns:
            Dictionary with current status details
        """
        with self._lock:
            return {
                'message': self.current_message,
                'type': self.current_type,
                'timestamp': datetime.now()
            }
    
    def get_message_history(self) -> list:
        """
        Get message history.
        
        Returns:
            List of message history entries
        """
        with self._lock:
            return self.message_history.copy()
    
    def clear_history(self):
        """Clear message history."""
        with self._lock:
            self.message_history.clear()
    
    def configure_auto_clear(self, delay_ms: int):
        """
        Configure auto-clear delay.
        
        Args:
            delay_ms: Delay in milliseconds (0 to disable)
        """
        self.auto_clear_delay = delay_ms
    
    def configure_timestamp(self, show: bool):
        """
        Configure timestamp display.
        
        Args:
            show: Whether to show timestamps
        """
        self.show_timestamp = show
        
        if show:
            self.timestamp_label.grid()
        else:
            self.timestamp_label.grid_remove()
    
    def destroy(self):
        """Clean up resources when destroying widget."""
        # Stop progress animation
        if self.progress_job:
            self.progress_job = None
        
        # Cancel auto-clear job
        if self.auto_clear_job:
            self.after_cancel(self.auto_clear_job)
        
        super().destroy()