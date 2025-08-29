"""
Notification manager for user feedback and alerts.
Provides toast notifications, progress indicators, and status updates.
"""
import tkinter as tk
from tkinter import ttk
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timedelta
from enum import Enum
import threading
import time


class NotificationType(Enum):
    """Types of notifications."""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    PROGRESS = "progress"


class NotificationPosition(Enum):
    """Notification display positions."""
    TOP_RIGHT = "top_right"
    TOP_LEFT = "top_left"
    BOTTOM_RIGHT = "bottom_right"
    BOTTOM_LEFT = "bottom_left"
    CENTER = "center"


class ToastNotification:
    """Individual toast notification widget."""
    
    def __init__(self, 
                 parent: tk.Tk,
                 message: str,
                 notification_type: NotificationType = NotificationType.INFO,
                 duration: int = 3000,
                 position: NotificationPosition = NotificationPosition.TOP_RIGHT,
                 on_click: Optional[Callable] = None,
                 on_close: Optional[Callable] = None):
        """
        Initialize toast notification.
        
        Args:
            parent: Parent window
            message: Notification message
            notification_type: Type of notification
            duration: Display duration in milliseconds (0 for persistent)
            position: Display position
            on_click: Callback when notification is clicked
            on_close: Callback when notification is closed
        """
        self.parent = parent
        self.message = message
        self.notification_type = notification_type
        self.duration = duration
        self.position = position
        self.on_click = on_click
        self.on_close = on_close
        
        # Create notification window
        self.window = tk.Toplevel(parent)
        self.window.withdraw()  # Hide initially
        
        # Configure window
        self._configure_window()
        self._create_widgets()
        self._position_window()
        
        # Auto-hide timer
        self.hide_job = None
        if duration > 0:
            self.hide_job = self.window.after(duration, self.hide)
        
        # Show with animation
        self._show_animated()
    
    def _configure_window(self):
        """Configure notification window properties."""
        self.window.overrideredirect(True)  # Remove window decorations
        self.window.attributes('-topmost', True)  # Always on top
        self.window.attributes('-alpha', 0.95)  # Slight transparency
        
        # Configure colors based on notification type
        colors = {
            NotificationType.INFO: {'bg': '#e3f2fd', 'fg': '#1976d2', 'border': '#2196f3'},
            NotificationType.SUCCESS: {'bg': '#e8f5e8', 'fg': '#2e7d32', 'border': '#4caf50'},
            NotificationType.WARNING: {'bg': '#fff3e0', 'fg': '#f57c00', 'border': '#ff9800'},
            NotificationType.ERROR: {'bg': '#ffebee', 'fg': '#d32f2f', 'border': '#f44336'},
            NotificationType.PROGRESS: {'bg': '#f3e5f5', 'fg': '#7b1fa2', 'border': '#9c27b0'}
        }
        
        self.colors = colors.get(self.notification_type, colors[NotificationType.INFO])
        self.window.configure(bg=self.colors['border'])
    
    def _create_widgets(self):
        """Create notification widgets."""
        # Main frame with padding for border effect
        self.main_frame = tk.Frame(
            self.window,
            bg=self.colors['bg'],
            padx=15,
            pady=10
        )
        self.main_frame.pack(fill='both', expand=True, padx=2, pady=2)
        
        # Icon and message frame
        content_frame = tk.Frame(self.main_frame, bg=self.colors['bg'])
        content_frame.pack(fill='x')
        
        # Notification icon
        icon_text = self._get_icon_text()
        self.icon_label = tk.Label(
            content_frame,
            text=icon_text,
            font=('Segoe UI', 12),
            fg=self.colors['fg'],
            bg=self.colors['bg']
        )
        self.icon_label.pack(side='left', padx=(0, 8))
        
        # Message label
        self.message_label = tk.Label(
            content_frame,
            text=self.message,
            font=('Segoe UI', 9),
            fg=self.colors['fg'],
            bg=self.colors['bg'],
            wraplength=250,
            justify='left'
        )
        self.message_label.pack(side='left', fill='x', expand=True)
        
        # Close button
        self.close_button = tk.Label(
            content_frame,
            text='×',
            font=('Segoe UI', 12, 'bold'),
            fg=self.colors['fg'],
            bg=self.colors['bg'],
            cursor='hand2'
        )
        self.close_button.pack(side='right', padx=(8, 0))
        
        # Bind events
        self.close_button.bind('<Button-1>', lambda e: self.hide())
        
        if self.on_click:
            self.main_frame.bind('<Button-1>', lambda e: self.on_click())
            self.message_label.bind('<Button-1>', lambda e: self.on_click())
            self.icon_label.bind('<Button-1>', lambda e: self.on_click())
        
        # Hover effects
        self._setup_hover_effects()
    
    def _get_icon_text(self) -> str:
        """Get icon text for notification type."""
        icons = {
            NotificationType.INFO: 'ℹ',
            NotificationType.SUCCESS: '✓',
            NotificationType.WARNING: '⚠',
            NotificationType.ERROR: '✗',
            NotificationType.PROGRESS: '◐'
        }
        return icons.get(self.notification_type, 'ℹ')
    
    def _setup_hover_effects(self):
        """Set up hover effects for interactive elements."""
        def on_enter(event):
            event.widget.configure(bg=self.colors['border'])
        
        def on_leave(event):
            event.widget.configure(bg=self.colors['bg'])
        
        self.close_button.bind('<Enter>', on_enter)
        self.close_button.bind('<Leave>', on_leave)
        
        if self.on_click:
            self.main_frame.bind('<Enter>', lambda e: self.main_frame.configure(bg=self.colors['border']))
            self.main_frame.bind('<Leave>', lambda e: self.main_frame.configure(bg=self.colors['bg']))
    
    def _position_window(self):
        """Position the notification window."""
        self.window.update_idletasks()
        
        # Get window dimensions
        width = self.window.winfo_reqwidth()
        height = self.window.winfo_reqheight()
        
        # Get screen dimensions
        screen_width = self.parent.winfo_screenwidth()
        screen_height = self.parent.winfo_screenheight()
        
        # Calculate position based on position setting
        margin = 20
        
        if self.position == NotificationPosition.TOP_RIGHT:
            x = screen_width - width - margin
            y = margin
        elif self.position == NotificationPosition.TOP_LEFT:
            x = margin
            y = margin
        elif self.position == NotificationPosition.BOTTOM_RIGHT:
            x = screen_width - width - margin
            y = screen_height - height - margin
        elif self.position == NotificationPosition.BOTTOM_LEFT:
            x = margin
            y = screen_height - height - margin
        else:  # CENTER
            x = (screen_width - width) // 2
            y = (screen_height - height) // 2
        
        self.window.geometry(f"{width}x{height}+{x}+{y}")
    
    def _show_animated(self):
        """Show notification with fade-in animation."""
        self.window.deiconify()
        
        # Simple fade-in effect
        alpha = 0.0
        def fade_in():
            nonlocal alpha
            alpha += 0.1
            if alpha <= 0.95:
                self.window.attributes('-alpha', alpha)
                self.window.after(50, fade_in)
            else:
                self.window.attributes('-alpha', 0.95)
        
        fade_in()
    
    def hide(self):
        """Hide the notification."""
        if self.hide_job:
            self.window.after_cancel(self.hide_job)
            self.hide_job = None
        
        # Fade out animation
        alpha = 0.95
        def fade_out():
            nonlocal alpha
            alpha -= 0.15
            if alpha > 0:
                self.window.attributes('-alpha', alpha)
                self.window.after(30, fade_out)
            else:
                self._destroy()
        
        fade_out()
    
    def _destroy(self):
        """Destroy the notification window."""
        if self.on_close:
            try:
                self.on_close()
            except Exception:
                pass
        
        try:
            self.window.destroy()
        except Exception:
            pass
    
    def update_message(self, message: str):
        """Update notification message."""
        self.message = message
        self.message_label.configure(text=message)
    
    def extend_duration(self, additional_ms: int):
        """Extend notification display duration."""
        if self.hide_job:
            self.window.after_cancel(self.hide_job)
            self.hide_job = self.window.after(additional_ms, self.hide)


class NotificationManager:
    """
    Manager for application notifications and user feedback.
    
    Provides centralized notification management with toast notifications,
    progress indicators, and status updates.
    """
    
    def __init__(self, parent: tk.Tk):
        """
        Initialize notification manager.
        
        Args:
            parent: Parent window for notifications
        """
        self.parent = parent
        self.active_notifications: Dict[str, ToastNotification] = {}
        self.notification_queue = []
        self.max_concurrent_notifications = 5
        
        # Default settings
        self.default_duration = 3000
        self.default_position = NotificationPosition.TOP_RIGHT
        
        # Progress tracking
        self.progress_notifications: Dict[str, ToastNotification] = {}
    
    def show_info(self, 
                  message: str, 
                  title: Optional[str] = None,
                  duration: int = None,
                  on_click: Optional[Callable] = None) -> str:
        """
        Show info notification.
        
        Args:
            message: Notification message
            title: Optional title (prepended to message)
            duration: Display duration in milliseconds
            on_click: Callback when clicked
            
        Returns:
            Notification ID
        """
        full_message = f"{title}: {message}" if title else message
        return self._show_notification(
            full_message,
            NotificationType.INFO,
            duration or self.default_duration,
            on_click
        )
    
    def show_success(self, 
                     message: str, 
                     title: Optional[str] = None,
                     duration: int = None,
                     on_click: Optional[Callable] = None) -> str:
        """Show success notification."""
        full_message = f"{title}: {message}" if title else message
        return self._show_notification(
            full_message,
            NotificationType.SUCCESS,
            duration or self.default_duration,
            on_click
        )
    
    def show_warning(self, 
                     message: str, 
                     title: Optional[str] = None,
                     duration: int = None,
                     on_click: Optional[Callable] = None) -> str:
        """Show warning notification."""
        full_message = f"{title}: {message}" if title else message
        return self._show_notification(
            full_message,
            NotificationType.WARNING,
            duration or (self.default_duration * 2),  # Warnings stay longer
            on_click
        )
    
    def show_error(self, 
                   message: str, 
                   title: Optional[str] = None,
                   duration: int = 0,  # Errors are persistent by default
                   on_click: Optional[Callable] = None) -> str:
        """Show error notification."""
        full_message = f"{title}: {message}" if title else message
        return self._show_notification(
            full_message,
            NotificationType.ERROR,
            duration,
            on_click
        )
    
    def show_progress(self, 
                      message: str, 
                      progress_id: str,
                      title: Optional[str] = None) -> str:
        """
        Show progress notification.
        
        Args:
            message: Progress message
            progress_id: Unique ID for this progress operation
            title: Optional title
            
        Returns:
            Notification ID
        """
        full_message = f"{title}: {message}" if title else message
        
        # Remove existing progress notification with same ID
        if progress_id in self.progress_notifications:
            self.hide_notification(progress_id)
        
        notification_id = self._show_notification(
            full_message,
            NotificationType.PROGRESS,
            0,  # Progress notifications are persistent
            None
        )
        
        self.progress_notifications[progress_id] = self.active_notifications[notification_id]
        return notification_id
    
    def update_progress(self, progress_id: str, message: str, title: Optional[str] = None):
        """
        Update progress notification message.
        
        Args:
            progress_id: Progress operation ID
            message: Updated message
            title: Optional title
        """
        if progress_id in self.progress_notifications:
            full_message = f"{title}: {message}" if title else message
            self.progress_notifications[progress_id].update_message(full_message)
    
    def complete_progress(self, 
                         progress_id: str, 
                         success_message: str = "Completed",
                         title: Optional[str] = None,
                         show_success: bool = True):
        """
        Complete progress operation.
        
        Args:
            progress_id: Progress operation ID
            success_message: Success message to show
            title: Optional title
            show_success: Whether to show success notification
        """
        # Hide progress notification
        if progress_id in self.progress_notifications:
            notification = self.progress_notifications[progress_id]
            notification.hide()
            del self.progress_notifications[progress_id]
        
        # Show success notification if requested
        if show_success:
            self.show_success(success_message, title, duration=2000)
    
    def fail_progress(self, 
                     progress_id: str, 
                     error_message: str = "Failed",
                     title: Optional[str] = None,
                     show_error: bool = True):
        """
        Fail progress operation.
        
        Args:
            progress_id: Progress operation ID
            error_message: Error message to show
            title: Optional title
            show_error: Whether to show error notification
        """
        # Hide progress notification
        if progress_id in self.progress_notifications:
            notification = self.progress_notifications[progress_id]
            notification.hide()
            del self.progress_notifications[progress_id]
        
        # Show error notification if requested
        if show_error:
            self.show_error(error_message, title)
    
    def _show_notification(self, 
                          message: str,
                          notification_type: NotificationType,
                          duration: int,
                          on_click: Optional[Callable] = None) -> str:
        """
        Show notification with specified parameters.
        
        Args:
            message: Notification message
            notification_type: Type of notification
            duration: Display duration
            on_click: Click callback
            
        Returns:
            Notification ID
        """
        # Generate unique ID
        notification_id = f"{notification_type.value}_{int(time.time() * 1000)}"
        
        # Check if we have too many active notifications
        if len(self.active_notifications) >= self.max_concurrent_notifications:
            # Remove oldest notification
            oldest_id = next(iter(self.active_notifications))
            self.hide_notification(oldest_id)
        
        # Create notification
        def on_close():
            if notification_id in self.active_notifications:
                del self.active_notifications[notification_id]
        
        notification = ToastNotification(
            self.parent,
            message,
            notification_type,
            duration,
            self.default_position,
            on_click,
            on_close
        )
        
        self.active_notifications[notification_id] = notification
        return notification_id
    
    def hide_notification(self, notification_id: str):
        """
        Hide specific notification.
        
        Args:
            notification_id: ID of notification to hide
        """
        if notification_id in self.active_notifications:
            self.active_notifications[notification_id].hide()
    
    def hide_all_notifications(self):
        """Hide all active notifications."""
        for notification in list(self.active_notifications.values()):
            notification.hide()
        
        self.active_notifications.clear()
        self.progress_notifications.clear()
    
    def set_default_position(self, position: NotificationPosition):
        """Set default notification position."""
        self.default_position = position
    
    def set_default_duration(self, duration: int):
        """Set default notification duration."""
        self.default_duration = duration
    
    def get_active_count(self) -> int:
        """Get number of active notifications."""
        return len(self.active_notifications)
    
    def get_progress_count(self) -> int:
        """Get number of active progress notifications."""
        return len(self.progress_notifications)


# Global notification manager instance
_global_notification_manager: Optional[NotificationManager] = None


def get_notification_manager(parent: Optional[tk.Tk] = None) -> NotificationManager:
    """
    Get the global notification manager instance.
    
    Args:
        parent: Parent window (required for first call)
        
    Returns:
        NotificationManager instance
    """
    global _global_notification_manager
    
    if _global_notification_manager is None:
        if parent is None:
            raise ValueError("Parent window required for first initialization")
        _global_notification_manager = NotificationManager(parent)
    
    return _global_notification_manager


def show_notification(message: str, 
                     notification_type: str = "info",
                     title: Optional[str] = None,
                     duration: Optional[int] = None,
                     parent: Optional[tk.Tk] = None) -> str:
    """
    Convenience function to show notifications.
    
    Args:
        message: Notification message
        notification_type: Type of notification (info, success, warning, error)
        title: Optional title
        duration: Display duration
        parent: Parent window
        
    Returns:
        Notification ID
    """
    manager = get_notification_manager(parent)
    
    if notification_type == "success":
        return manager.show_success(message, title, duration)
    elif notification_type == "warning":
        return manager.show_warning(message, title, duration)
    elif notification_type == "error":
        return manager.show_error(message, title, duration)
    else:
        return manager.show_info(message, title, duration)