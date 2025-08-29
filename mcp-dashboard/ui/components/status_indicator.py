"""
Status indicator component for displaying service health status.
Provides visual feedback with color coding and tooltips for health information.
"""
import tkinter as tk
from tkinter import ttk
from typing import Optional, Callable
from datetime import datetime

from services.health_checker import ServiceHealthInfo, HealthStatus


class StatusIndicator(ttk.Frame):
    """
    Visual status indicator component for service health display.
    
    Shows health status with color-coded indicators and detailed tooltips.
    Supports real-time updates and click callbacks for additional actions.
    """
    
    # Color scheme for different health statuses
    STATUS_COLORS = {
        HealthStatus.HEALTHY: "#28a745",      # Green
        HealthStatus.UNHEALTHY: "#dc3545",    # Red
        HealthStatus.UNKNOWN: "#6c757d",      # Gray
        HealthStatus.CHECKING: "#ffc107"      # Yellow/Orange
    }
    
    STATUS_TEXT = {
        HealthStatus.HEALTHY: "Healthy",
        HealthStatus.UNHEALTHY: "Unhealthy", 
        HealthStatus.UNKNOWN: "Unknown",
        HealthStatus.CHECKING: "Checking"
    }
    
    def __init__(
        self, 
        parent, 
        service_name: str,
        initial_status: HealthStatus = HealthStatus.UNKNOWN,
        show_text: bool = True,
        show_response_time: bool = True,
        on_click: Optional[Callable[[str], None]] = None,
        **kwargs
    ):
        """
        Initialize status indicator.
        
        Args:
            parent: Parent widget
            service_name: Name of the service this indicator represents
            initial_status: Initial health status
            show_text: Whether to show status text alongside indicator
            show_response_time: Whether to show response time in tooltip
            on_click: Optional callback when indicator is clicked
            **kwargs: Additional arguments for ttk.Frame
        """
        super().__init__(parent, **kwargs)
        
        self.service_name = service_name
        self.show_text = show_text
        self.show_response_time = show_response_time
        self.on_click = on_click
        
        # Current health information
        self._health_info: Optional[ServiceHealthInfo] = None
        self._current_status = initial_status
        
        # Create UI elements
        self._create_widgets()
        self._setup_layout()
        self._setup_bindings()
        
        # Set initial status
        self.update_status(initial_status)
    
    def _create_widgets(self):
        """Create the UI widgets for the status indicator."""
        # Status indicator circle/dot
        self.status_canvas = tk.Canvas(
            self,
            width=16,
            height=16,
            highlightthickness=0,
            relief='flat'
        )
        
        # Status text label (optional)
        if self.show_text:
            self.status_label = ttk.Label(
                self,
                text=self.STATUS_TEXT[self._current_status],
                font=('Segoe UI', 9)
            )
        
        # Service name label
        self.service_label = ttk.Label(
            self,
            text=self.service_name,
            font=('Segoe UI', 9, 'bold')
        )
        
        # Create tooltip
        self._tooltip = None
        self._create_tooltip()
    
    def _setup_layout(self):
        """Set up the layout of widgets."""
        # Configure grid weights
        self.columnconfigure(2, weight=1)
        
        # Place widgets
        self.status_canvas.grid(row=0, column=0, padx=(0, 5), pady=2, sticky='w')
        
        if self.show_text:
            self.status_label.grid(row=0, column=1, padx=(0, 10), pady=2, sticky='w')
            self.service_label.grid(row=0, column=2, pady=2, sticky='w')
        else:
            self.service_label.grid(row=0, column=1, padx=(5, 0), pady=2, sticky='w')
    
    def _setup_bindings(self):
        """Set up event bindings."""
        # Click handling
        if self.on_click:
            widgets_to_bind = [self, self.status_canvas, self.service_label]
            if self.show_text:
                widgets_to_bind.append(self.status_label)
            
            for widget in widgets_to_bind:
                widget.bind("<Button-1>", self._handle_click)
                widget.bind("<Enter>", self._on_enter)
                widget.bind("<Leave>", self._on_leave)
        
        # Tooltip bindings
        self.bind("<Enter>", self._show_tooltip)
        self.bind("<Leave>", self._hide_tooltip)
        self.bind("<Motion>", self._move_tooltip)
    
    def _handle_click(self, event):
        """Handle click events on the status indicator."""
        if self.on_click:
            self.on_click(self.service_name)
    
    def _on_enter(self, event):
        """Handle mouse enter events for hover effects."""
        if self.on_click:
            self.configure(cursor="hand2")
    
    def _on_leave(self, event):
        """Handle mouse leave events."""
        if self.on_click:
            self.configure(cursor="")
    
    def _create_tooltip(self):
        """Create tooltip window for detailed status information."""
        self._tooltip = tk.Toplevel(self)
        self._tooltip.withdraw()
        self._tooltip.overrideredirect(True)
        self._tooltip.configure(bg='#ffffe0', relief='solid', borderwidth=1)
        
        self._tooltip_label = tk.Label(
            self._tooltip,
            bg='#ffffe0',
            fg='black',
            font=('Segoe UI', 8),
            justify='left',
            padx=5,
            pady=3
        )
        self._tooltip_label.pack()
    
    def _show_tooltip(self, event):
        """Show tooltip with detailed status information."""
        if not self._tooltip:
            return
        
        tooltip_text = self._generate_tooltip_text()
        self._tooltip_label.configure(text=tooltip_text)
        
        # Position tooltip near cursor
        x = self.winfo_rootx() + 20
        y = self.winfo_rooty() + 20
        
        self._tooltip.geometry(f"+{x}+{y}")
        self._tooltip.deiconify()
    
    def _hide_tooltip(self, event):
        """Hide the tooltip."""
        if self._tooltip:
            self._tooltip.withdraw()
    
    def _move_tooltip(self, event):
        """Move tooltip with mouse cursor."""
        if self._tooltip and self._tooltip.winfo_viewable():
            x = self.winfo_rootx() + event.x + 10
            y = self.winfo_rooty() + event.y + 10
            self._tooltip.geometry(f"+{x}+{y}")
    
    def _generate_tooltip_text(self) -> str:
        """Generate tooltip text based on current health information."""
        if not self._health_info:
            return f"Service: {self.service_name}\nStatus: {self.STATUS_TEXT[self._current_status]}"
        
        lines = [
            f"Service: {self.service_name}",
            f"Status: {self.STATUS_TEXT[self._health_info.status]}"
        ]
        
        # Add response time if available and enabled
        if self.show_response_time and self._health_info.response_time is not None:
            lines.append(f"Response Time: {self._health_info.response_time:.1f}ms")
        
        # Add last check time
        if self._health_info.last_check:
            time_str = self._health_info.last_check.strftime("%H:%M:%S")
            lines.append(f"Last Check: {time_str}")
        
        # Add uptime percentage
        if self._health_info.total_checks > 0:
            lines.append(f"Uptime: {self._health_info.uptime_percentage:.1f}%")
        
        # Add error details if unhealthy
        if (self._health_info.status == HealthStatus.UNHEALTHY and 
            self._health_info.error_details):
            lines.append(f"Error: {self._health_info.error_details}")
        
        # Add consecutive status info
        if self._health_info.consecutive_successes > 0:
            lines.append(f"Consecutive Successes: {self._health_info.consecutive_successes}")
        elif self._health_info.consecutive_failures > 0:
            lines.append(f"Consecutive Failures: {self._health_info.consecutive_failures}")
        
        return "\n".join(lines)
    
    def update_status(self, status: HealthStatus, health_info: Optional[ServiceHealthInfo] = None):
        """
        Update the status indicator with new health information.
        
        Args:
            status: New health status
            health_info: Optional detailed health information
        """
        previous_status = self._current_status
        self._current_status = status
        self._health_info = health_info
        
        # Update visual indicator
        self._update_status_indicator()
        
        # Update text label if shown
        if self.show_text:
            self.status_label.configure(text=self.STATUS_TEXT[status])
        
        # Show visual feedback for status changes
        if previous_status != status and previous_status != HealthStatus.UNKNOWN:
            self._show_status_change_feedback(previous_status, status)
    
    def _show_status_change_feedback(self, old_status: HealthStatus, new_status: HealthStatus):
        """
        Show visual feedback for status changes.
        
        Args:
            old_status: Previous health status
            new_status: New health status
        """
        try:
            # Flash effect for significant status changes
            if (old_status == HealthStatus.UNHEALTHY and new_status == HealthStatus.HEALTHY) or \
               (old_status == HealthStatus.HEALTHY and new_status == HealthStatus.UNHEALTHY):
                
                # Create flash effect
                self._flash_status_change(new_status)
                
        except Exception as e:
            # Don't let visual effects break the status update
            pass
    
    def _flash_status_change(self, new_status: HealthStatus):
        """
        Create a flash effect for status changes.
        
        Args:
            new_status: The new status to flash
        """
        try:
            # Save current canvas state
            original_color = self.STATUS_COLORS.get(new_status, "#6c757d")
            
            # Flash with white background
            def flash_white():
                self.status_canvas.delete("all")
                self.status_canvas.create_oval(
                    2, 2, 14, 14,
                    fill="white",
                    outline=original_color,
                    width=2
                )
            
            # Restore normal appearance
            def restore_normal():
                self._update_status_indicator()
            
            # Execute flash sequence
            flash_white()
            self.after(150, restore_normal)
            
        except Exception:
            # Fallback to normal update if flash fails
            self._update_status_indicator()
    
    def _update_status_indicator(self):
        """Update the visual status indicator (colored circle)."""
        # Clear canvas
        self.status_canvas.delete("all")
        
        # Get color for current status
        color = self.STATUS_COLORS.get(self._current_status, "#6c757d")
        
        # Draw status circle
        self.status_canvas.create_oval(
            2, 2, 14, 14,
            fill=color,
            outline=color,
            width=1
        )
        
        # Add inner highlight for healthy status
        if self._current_status == HealthStatus.HEALTHY:
            self.status_canvas.create_oval(
                4, 4, 12, 12,
                fill="",
                outline="white",
                width=1
            )
        
        # Add pulsing effect for checking status
        if self._current_status == HealthStatus.CHECKING:
            self._animate_checking()
    
    def _animate_checking(self):
        """Animate the checking status indicator."""
        # Enhanced animation with pulsing effect
        current_color = self.STATUS_COLORS[HealthStatus.CHECKING]
        
        def pulse():
            if self._current_status == HealthStatus.CHECKING:
                # Create pulsing effect by alternating between normal and highlighted
                self.status_canvas.delete("all")
                
                # Outer ring for pulse effect
                self.status_canvas.create_oval(
                    1, 1, 15, 15,
                    fill="",
                    outline=current_color,
                    width=2
                )
                
                # Inner circle
                self.status_canvas.create_oval(
                    4, 4, 12, 12,
                    fill=current_color,
                    outline=current_color,
                    width=1
                )
                
                # Schedule next pulse with fade effect
                self.after(300, lambda: _pulse_fade() if self._current_status == HealthStatus.CHECKING else None)
                self.after(600, pulse)
        
        def _pulse_fade():
            """Create fade effect for pulse animation."""
            if self._current_status == HealthStatus.CHECKING:
                self.status_canvas.delete("all")
                self.status_canvas.create_oval(
                    2, 2, 14, 14,
                    fill=current_color,
                    outline=current_color,
                    width=1
                )
        
        pulse()
    
    def set_service_name(self, service_name: str):
        """
        Update the service name displayed.
        
        Args:
            service_name: New service name
        """
        self.service_name = service_name
        self.service_label.configure(text=service_name)
    
    def get_current_status(self) -> HealthStatus:
        """
        Get the current health status.
        
        Returns:
            Current health status
        """
        return self._current_status
    
    def get_health_info(self) -> Optional[ServiceHealthInfo]:
        """
        Get the current health information.
        
        Returns:
            Current health information or None
        """
        return self._health_info
    
    def set_click_callback(self, callback: Optional[Callable[[str], None]]):
        """
        Set or update the click callback.
        
        Args:
            callback: New click callback function
        """
        self.on_click = callback
        # Re-setup bindings to apply new callback
        self._setup_bindings()
    
    def destroy(self):
        """Clean up resources when destroying the widget."""
        if self._tooltip:
            self._tooltip.destroy()
        super().destroy()