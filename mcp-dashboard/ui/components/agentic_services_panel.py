#!/usr/bin/env python3
"""
Agentic Services Panel for MCP Dashboard
Provides a visual interface to control and monitor the Agentic Microservices system
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import threading
import time
import json
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import sys
import os

# Add project root to path for imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

try:
    from services.agentic_microservices_bridge import (
        get_bridge, start_agentic_system, stop_agentic_system,
        get_system_status, send_chat, run_fraud_check, get_product_recommendations
    )
except ImportError as e:
    print(f"Warning: Could not import agentic services bridge: {e}")
    print("Agentic Services panel will show placeholder content")

class AgenticServicesPanel:
    """
    Panel for controlling and monitoring Agentic Microservices system.
    Integrates with the MCP Dashboard to provide visual management of AI agents.
    """

    def __init__(self, parent_frame: tk.Frame, on_status_change: Callable = None):
        """
        Initialize the Agentic Services panel.

        Args:
            parent_frame: Parent tkinter frame
            on_status_change: Callback for status changes
        """
        self.parent = parent_frame
        self.on_status_change = on_status_change
        self.logger = self._setup_logger()

        # System state
        self.system_running = False
        self.agents_status = {}
        self.monitoring_active = False

        # UI components
        self.main_frame = None
        self.control_frame = None
        self.status_frame = None
        self.chat_frame = None
        self.fraud_frame = None
        self.recommendation_frame = None
        self.monitoring_frame = None

        # Control buttons
        self.start_button = None
        self.stop_button = None
        self.refresh_button = None

        # Status displays
        self.status_text = None
        self.agent_status_labels = {}

        # Chat components
        self.chat_input = None
        self.chat_output = None
        self.chat_send_button = None

        # Fraud detection components
        self.fraud_amount_input = None
        self.fraud_check_button = None
        self.fraud_result_text = None

        # Recommendation components
        self.recommendation_category_input = None
        self.recommendation_button = None
        self.recommendation_result_text = None

        # Monitoring components
        self.monitoring_text = None

        # Background monitoring
        self.monitoring_thread = None
        self.monitoring_stop_event = threading.Event()

        self._create_ui()
        self._setup_event_handlers()

    def _setup_logger(self):
        """Set up logging for the panel"""
        import logging
        logger = logging.getLogger("AgenticServicesPanel")
        logger.setLevel(logging.INFO)

        # Add handler if not already present
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)

        return logger

    def _create_ui(self):
        """Create the main UI components"""
        # Main container
        self.main_frame = ttk.Frame(self.parent)
        self.main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Title
        title_label = ttk.Label(
            self.main_frame,
            text="🤖 Agentic Microservices Control Panel",
            font=('Segoe UI', 14, 'bold')
        )
        title_label.pack(pady=(0, 10))

        # Create notebook for different sections
        self.notebook = ttk.Notebook(self.main_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)

        # Create tabs
        self._create_control_tab()
        self._create_chat_tab()
        self._create_fraud_tab()
        self._create_recommendation_tab()
        self._create_monitoring_tab()

    def _create_control_tab(self):
        """Create the system control tab"""
        control_frame = ttk.Frame(self.notebook)
        self.notebook.add(control_frame, text="System Control")

        # Control buttons
        button_frame = ttk.Frame(control_frame)
        button_frame.pack(pady=10)

        self.start_button = ttk.Button(
            button_frame,
            text="🚀 Start System",
            command=self._start_system,
            style='success.TButton'
        )
        self.start_button.pack(side=tk.LEFT, padx=5)

        self.stop_button = ttk.Button(
            button_frame,
            text="⏹️ Stop System",
            command=self._stop_system,
            state='disabled',
            style='danger.TButton'
        )
        self.stop_button.pack(side=tk.LEFT, padx=5)

        self.refresh_button = ttk.Button(
            button_frame,
            text="🔄 Refresh Status",
            command=self._refresh_status
        )
        self.refresh_button.pack(side=tk.LEFT, padx=5)

        # Status display
        status_frame = ttk.LabelFrame(control_frame, text="System Status", padding=10)
        status_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self.status_text = scrolledtext.ScrolledText(
            status_frame,
            height=15,
            font=('Consolas', 9),
            state='disabled'
        )
        self.status_text.pack(fill=tk.BOTH, expand=True)

        # Initial status
        self._update_status_display("System not started. Click 'Start System' to begin.")

    def _create_chat_tab(self):
        """Create the chatbot interaction tab"""
        chat_frame = ttk.Frame(self.notebook)
        self.notebook.add(chat_frame, text="Chatbot")

        # Input section
        input_frame = ttk.LabelFrame(chat_frame, text="Send Message", padding=10)
        input_frame.pack(fill=tk.X, padx=10, pady=5)

        self.chat_input = ttk.Entry(input_frame, font=('Segoe UI', 10))
        self.chat_input.pack(fill=tk.X, pady=(0, 5))
        self.chat_input.bind('<Return>', lambda e: self._send_chat_message())

        self.chat_send_button = ttk.Button(
            input_frame,
            text="📤 Send Message",
            command=self._send_chat_message
        )
        self.chat_send_button.pack(anchor=tk.E)

        # Output section
        output_frame = ttk.LabelFrame(chat_frame, text="Chat History", padding=10)
        output_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.chat_output = scrolledtext.ScrolledText(
            output_frame,
            height=20,
            font=('Segoe UI', 9),
            state='disabled'
        )
        self.chat_output.pack(fill=tk.BOTH, expand=True)

        # Initial message
        self._add_chat_message("System", "Chatbot not available. Please start the system first.", "system")

    def _create_fraud_tab(self):
        """Create the fraud detection tab"""
        fraud_frame = ttk.Frame(self.notebook)
        self.notebook.add(fraud_frame, text="Fraud Detection")

        # Input section
        input_frame = ttk.LabelFrame(fraud_frame, text="Transaction Analysis", padding=10)
        input_frame.pack(fill=tk.X, padx=10, pady=5)

        amount_frame = ttk.Frame(input_frame)
        amount_frame.pack(fill=tk.X, pady=(0, 5))

        ttk.Label(amount_frame, text="Amount ($):").pack(side=tk.LEFT)
        self.fraud_amount_input = ttk.Entry(amount_frame, width=20)
        self.fraud_amount_input.pack(side=tk.LEFT, padx=(5, 0))
        self.fraud_amount_input.insert(0, "2500.00")

        self.fraud_check_button = ttk.Button(
            input_frame,
            text="🔍 Analyze Transaction",
            command=self._run_fraud_check
        )
        self.fraud_check_button.pack(anchor=tk.E)

        # Results section
        results_frame = ttk.LabelFrame(fraud_frame, text="Analysis Results", padding=10)
        results_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.fraud_result_text = scrolledtext.ScrolledText(
            results_frame,
            height=15,
            font=('Segoe UI', 9),
            state='disabled'
        )
        self.fraud_result_text.pack(fill=tk.BOTH, expand=True)

        # Initial message
        self._update_fraud_result("Fraud detection not available. Please start the system first.")

    def _create_recommendation_tab(self):
        """Create the recommendation tab"""
        rec_frame = ttk.Frame(self.notebook)
        self.notebook.add(rec_frame, text="Recommendations")

        # Input section
        input_frame = ttk.LabelFrame(rec_frame, text="Get Recommendations", padding=10)
        input_frame.pack(fill=tk.X, padx=10, pady=5)

        category_frame = ttk.Frame(input_frame)
        category_frame.pack(fill=tk.X, pady=(0, 5))

        ttk.Label(category_frame, text="Category:").pack(side=tk.LEFT)
        self.recommendation_category_input = ttk.Combobox(
            category_frame,
            values=["electronics", "books", "clothing", "home", "sports"],
            state="readonly",
            width=15
        )
        self.recommendation_category_input.pack(side=tk.LEFT, padx=(5, 0))
        self.recommendation_category_input.set("electronics")

        self.recommendation_button = ttk.Button(
            input_frame,
            text="🎯 Get Recommendations",
            command=self._get_recommendations
        )
        self.recommendation_button.pack(anchor=tk.E)

        # Results section
        results_frame = ttk.LabelFrame(rec_frame, text="Recommended Products", padding=10)
        results_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.recommendation_result_text = scrolledtext.ScrolledText(
            results_frame,
            height=15,
            font=('Segoe UI', 9),
            state='disabled'
        )
        self.recommendation_result_text.pack(fill=tk.BOTH, expand=True)

        # Initial message
        self._update_recommendation_result("Recommendation system not available. Please start the system first.")

    def _create_monitoring_tab(self):
        """Create the monitoring tab"""
        monitoring_frame = ttk.Frame(self.notebook)
        self.notebook.add(monitoring_frame, text="Monitoring")

        # Control buttons
        control_frame = ttk.Frame(monitoring_frame)
        control_frame.pack(fill=tk.X, padx=10, pady=5)

        self.monitoring_toggle_button = ttk.Button(
            control_frame,
            text="▶️ Start Monitoring",
            command=self._toggle_monitoring
        )
        self.monitoring_toggle_button.pack(side=tk.LEFT)

        ttk.Button(
            control_frame,
            text="🔄 Refresh",
            command=self._refresh_monitoring
        ).pack(side=tk.LEFT, padx=(5, 0))

        # Monitoring display
        monitoring_display_frame = ttk.LabelFrame(monitoring_frame, text="System Metrics", padding=10)
        monitoring_display_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.monitoring_text = scrolledtext.ScrolledText(
            monitoring_display_frame,
            height=20,
            font=('Consolas', 9),
            state='disabled'
        )
        self.monitoring_text.pack(fill=tk.BOTH, expand=True)

        # Initial message
        self._update_monitoring_display("Monitoring not started. Click 'Start Monitoring' to begin.")

    def _setup_event_handlers(self):
        """Set up event handlers"""
        # Add keyboard shortcuts
        self.main_frame.bind('<Control-r>', lambda e: self._refresh_status())
        self.main_frame.focus_set()

    def _start_system(self):
        """Start the Agentic Microservices system"""
        try:
            self._update_status_display("Starting Agentic Microservices system...")

            # Start system in background thread
            def start_system_thread():
                try:
                    result = start_agentic_system()
                    self.main_frame.after(0, lambda: self._handle_system_start_result(result))
                except Exception as e:
                    self.main_frame.after(0, lambda: self._handle_system_error("start", str(e)))

            thread = threading.Thread(target=start_system_thread, daemon=True)
            thread.start()

        except Exception as e:
            self._handle_system_error("start", str(e))

    def _stop_system(self):
        """Stop the Agentic Microservices system"""
        try:
            self._update_status_display("Stopping Agentic Microservices system...")

            # Stop monitoring first
            if self.monitoring_active:
                self._toggle_monitoring()

            # Stop system in background thread
            def stop_system_thread():
                try:
                    result = stop_agentic_system()
                    self.main_frame.after(0, lambda: self._handle_system_stop_result(result))
                except Exception as e:
                    self.main_frame.after(0, lambda: self._handle_system_error("stop", str(e)))

            thread = threading.Thread(target=stop_system_thread, daemon=True)
            thread.start()

        except Exception as e:
            self._handle_system_error("stop", str(e))

    def _refresh_status(self):
        """Refresh system status"""
        if not self.system_running:
            self._update_status_display("System not running. Please start the system first.")
            return

        try:
            def refresh_thread():
                try:
                    status = get_system_status()
                    self.main_frame.after(0, lambda: self._handle_status_refresh(status))
                except Exception as e:
                    self.main_frame.after(0, lambda: self._handle_system_error("status", str(e)))

            thread = threading.Thread(target=refresh_thread, daemon=True)
            thread.start()

        except Exception as e:
            self._handle_system_error("status", str(e))

    def _send_chat_message(self):
        """Send a chat message"""
        if not self.system_running:
            messagebox.showwarning("System Not Running", "Please start the system first.")
            return

        message = self.chat_input.get().strip()
        if not message:
            return

        # Clear input
        self.chat_input.delete(0, tk.END)

        # Add user message to chat
        self._add_chat_message("You", message, "user")

        # Send message in background
        def send_chat_thread():
            try:
                result = send_chat(message)
                self.main_frame.after(0, lambda: self._handle_chat_response(result))
            except Exception as e:
                self.main_frame.after(0, lambda: self._handle_chat_error(str(e)))

        thread = threading.Thread(target=send_chat_thread, daemon=True)
        thread.start()

    def _run_fraud_check(self):
        """Run fraud detection"""
        if not self.system_running:
            messagebox.showwarning("System Not Running", "Please start the system first.")
            return

        try:
            amount = float(self.fraud_amount_input.get().strip())
        except ValueError:
            messagebox.showerror("Invalid Amount", "Please enter a valid amount.")
            return

        self._update_fraud_result(f"Analyzing transaction of ${amount}...")

        # Run fraud check in background
        def fraud_check_thread():
            try:
                result = run_fraud_check(amount)
                self.main_frame.after(0, lambda: self._handle_fraud_result(result))
            except Exception as e:
                self.main_frame.after(0, lambda: self._handle_fraud_error(str(e)))

        thread = threading.Thread(target=fraud_check_thread, daemon=True)
        thread.start()

    def _get_recommendations(self):
        """Get product recommendations"""
        if not self.system_running:
            messagebox.showwarning("System Not Running", "Please start the system first.")
            return

        category = self.recommendation_category_input.get().strip()
        if not category:
            messagebox.showerror("Invalid Category", "Please select a category.")
            return

        self._update_recommendation_result(f"Getting recommendations for {category}...")

        # Get recommendations in background
        def recommendation_thread():
            try:
                result = get_product_recommendations(category)
                self.main_frame.after(0, lambda: self._handle_recommendation_result(result))
            except Exception as e:
                self.main_frame.after(0, lambda: self._handle_recommendation_error(str(e)))

        thread = threading.Thread(target=recommendation_thread, daemon=True)
        thread.start()

    def _toggle_monitoring(self):
        """Toggle monitoring on/off"""
        if not self.system_running:
            messagebox.showwarning("System Not Running", "Please start the system first.")
            return

        if self.monitoring_active:
            self._stop_monitoring()
        else:
            self._start_monitoring()

    def _start_monitoring(self):
        """Start system monitoring"""
        if self.monitoring_active:
            return

        self.monitoring_active = True
        self.monitoring_stop_event.clear()
        self.monitoring_toggle_button.config(text="⏹️ Stop Monitoring")

        # Start monitoring thread
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitoring_thread.start()

        self._update_monitoring_display("Monitoring started...")

    def _stop_monitoring(self):
        """Stop system monitoring"""
        if not self.monitoring_active:
            return

        self.monitoring_active = False
        self.monitoring_stop_event.set()
        self.monitoring_toggle_button.config(text="▶️ Start Monitoring")

        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=2)

        self._update_monitoring_display("Monitoring stopped.")

    def _monitoring_loop(self):
        """Main monitoring loop"""
        while not self.monitoring_stop_event.is_set():
            try:
                status = get_system_status()
                self.main_frame.after(0, lambda: self._update_monitoring_with_status(status))
            except Exception as e:
                self.main_frame.after(0, lambda: self._update_monitoring_display(f"Monitoring error: {str(e)}"))

            # Wait 5 seconds before next update
            time.sleep(5)

    def _refresh_monitoring(self):
        """Refresh monitoring display"""
        if not self.system_running:
            self._update_monitoring_display("System not running.")
            return

        try:
            status = get_system_status()
            self._update_monitoring_with_status(status)
        except Exception as e:
            self._update_monitoring_display(f"Error refreshing monitoring: {str(e)}")

    # Event handlers
    def _handle_system_start_result(self, result):
        """Handle system start result"""
        if result.get("success"):
            self.system_running = True
            self.start_button.config(state='disabled')
            self.stop_button.config(state='normal')
            self._update_status_display("✅ System started successfully!\n\n" + json.dumps(result, indent=2))
            self._add_chat_message("System", "Chatbot is now online!", "system")
            self._update_fraud_result("Fraud detection system ready.")
            self._update_recommendation_result("Recommendation system ready.")
        else:
            self._update_status_display(f"❌ Failed to start system: {result.get('message', 'Unknown error')}")

    def _handle_system_stop_result(self, result):
        """Handle system stop result"""
        if result.get("success"):
            self.system_running = False
            self.start_button.config(state='normal')
            self.stop_button.config(state='disabled')
            self._update_status_display("✅ System stopped successfully!")
            self._add_chat_message("System", "Chatbot offline.", "system")
            self._update_fraud_result("Fraud detection system offline.")
            self._update_recommendation_result("Recommendation system offline.")
        else:
            self._update_status_display(f"❌ Failed to stop system: {result.get('message', 'Unknown error')}")

    def _handle_status_refresh(self, status):
        """Handle status refresh"""
        self._update_status_display("📊 System Status:\n\n" + json.dumps(status, indent=2))

    def _handle_chat_response(self, result):
        """Handle chat response"""
        if result.get("success"):
            response = result.get("response", {})
            message = response.get("message", "No response")
            intent = response.get("intent", "unknown")
            confidence = response.get("confidence", 0)

            self._add_chat_message("Agent", message, "agent")
            self._add_chat_message("System", f"Intent: {intent} ({confidence:.1%} confidence)", "system")
        else:
            self._add_chat_message("System", f"Error: {result.get('message', 'Unknown error')}", "error")

    def _handle_fraud_result(self, result):
        """Handle fraud detection result"""
        if result.get("success"):
            assessment = result.get("assessment", {})
            risk_level = assessment.get("risk_level", "unknown")
            recommendation = assessment.get("recommendation", "unknown")

            result_text = f"🎯 Risk Assessment Complete\n\n"
            result_text += f"Risk Level: {risk_level.upper()}\n"
            result_text += f"Recommendation: {recommendation}\n\n"

            if "risk_factors" in assessment:
                result_text += "Risk Factors:\n"
                for factor in assessment["risk_factors"]:
                    result_text += f"• {factor}\n"

            self._update_fraud_result(result_text)
        else:
            self._update_fraud_result(f"❌ Error: {result.get('message', 'Unknown error')}")

    def _handle_recommendation_result(self, result):
        """Handle recommendation result"""
        if result.get("success"):
            recommendations = result.get("recommendations", [])
            category = result.get("category", "unknown")

            result_text = f"🎯 Recommendations for {category}\n\n"
            result_text += f"Found {len(recommendations)} recommendations:\n\n"

            for i, rec in enumerate(recommendations, 1):
                result_text += f"{i}. {rec.get('name', 'Unknown Product')}\n"
                result_text += f"   💰 Price: ${rec.get('price', 'N/A')}\n"
                result_text += f"   ⭐ Score: {rec.get('score', 'N/A')}\n"

                if rec.get("features"):
                    result_text += f"   ✨ Features: {', '.join(rec['features'])}\n"

                result_text += "\n"

            self._update_recommendation_result(result_text)
        else:
            self._update_recommendation_result(f"❌ Error: {result.get('message', 'Unknown error')}")

    def _handle_system_error(self, operation, error):
        """Handle system error"""
        error_msg = f"❌ {operation.title()} error: {error}"
        self._update_status_display(error_msg)
        messagebox.showerror(f"{operation.title()} Error", error_msg)

    def _handle_chat_error(self, error):
        """Handle chat error"""
        self._add_chat_message("System", f"Error: {error}", "error")

    def _handle_fraud_error(self, error):
        """Handle fraud detection error"""
        self._update_fraud_result(f"❌ Error: {error}")

    def _handle_recommendation_error(self, error):
        """Handle recommendation error"""
        self._update_recommendation_result(f"❌ Error: {error}")

    def _update_monitoring_with_status(self, status):
        """Update monitoring display with status"""
        if not status.get("is_running"):
            self._update_monitoring_display("System not running.")
            return

        metrics = status.get("metrics", {})
        agents = status.get("agents", [])

        display_text = f"📊 System Monitoring - {datetime.now().strftime('%H:%M:%S')}\n\n"
        display_text += f"System Status: {'🟢 Running' if status.get('is_running') else '🔴 Stopped'}\n"
        display_text += f"Total Agents: {metrics.get('total_agents', 0)}\n"
        display_text += f"Active Agents: {metrics.get('active_agents', 0)}\n"
        display_text += f"Total Requests: {metrics.get('total_requests', 0)}\n"
        display_text += f"Avg Response Time: {metrics.get('average_response_time', 0):.1f}ms\n"
        display_text += f"System Uptime: {metrics.get('system_uptime', 0):.0f}s\n"
        display_text += f"Memory Usage: {metrics.get('memory_usage', 0)} MB\n\n"

        if agents:
            display_text += "Agent Details:\n"
            for agent in agents:
                status_icon = "🟢" if agent.get("status") == "running" else "🔴"
                display_text += f"{status_icon} {agent.get('name', 'Unknown')}: {agent.get('status', 'unknown')}\n"
                display_text += f"   Requests: {agent.get('request_count', 0)}\n"
                display_text += f"   Memory: {agent.get('memory_usage', 0)} MB\n"
                display_text += f"   Uptime: {agent.get('uptime', 0):.0f}s\n\n"

        self._update_monitoring_display(display_text)

    # UI update methods
    def _update_status_display(self, text):
        """Update status display"""
        if self.status_text:
            self.status_text.config(state='normal')
            self.status_text.delete(1.0, tk.END)
            self.status_text.insert(tk.END, text)
            self.status_text.config(state='disabled')

    def _add_chat_message(self, sender, message, msg_type="user"):
        """Add message to chat output"""
        if self.chat_output:
            self.chat_output.config(state='normal')

            # Add timestamp
            timestamp = datetime.now().strftime("%H:%M:%S")

            # Color coding
            if msg_type == "user":
                self.chat_output.insert(tk.END, f"[{timestamp}] 👤 {sender}: ", "user")
                self.chat_output.insert(tk.END, f"{message}\n", "user_msg")
            elif msg_type == "agent":
                self.chat_output.insert(tk.END, f"[{timestamp}] 🤖 {sender}: ", "agent")
                self.chat_output.insert(tk.END, f"{message}\n", "agent_msg")
            elif msg_type == "system":
                self.chat_output.insert(tk.END, f"[{timestamp}] 🔧 {sender}: ", "system")
                self.chat_output.insert(tk.END, f"{message}\n", "system_msg")
            elif msg_type == "error":
                self.chat_output.insert(tk.END, f"[{timestamp}] ❌ {sender}: ", "error")
                self.chat_output.insert(tk.END, f"{message}\n", "error_msg")

            # Configure tags
            self.chat_output.tag_config("user", foreground="blue", font=('Segoe UI', 9, 'bold'))
            self.chat_output.tag_config("user_msg", foreground="blue")
            self.chat_output.tag_config("agent", foreground="green", font=('Segoe UI', 9, 'bold'))
            self.chat_output.tag_config("agent_msg", foreground="green")
            self.chat_output.tag_config("system", foreground="orange", font=('Segoe UI', 9, 'bold'))
            self.chat_output.tag_config("system_msg", foreground="orange")
            self.chat_output.tag_config("error", foreground="red", font=('Segoe UI', 9, 'bold'))
            self.chat_output.tag_config("error_msg", foreground="red")

            self.chat_output.config(state='disabled')
            self.chat_output.see(tk.END)

    def _update_fraud_result(self, text):
        """Update fraud detection result"""
        if self.fraud_result_text:
            self.fraud_result_text.config(state='normal')
            self.fraud_result_text.delete(1.0, tk.END)
            self.fraud_result_text.insert(tk.END, text)
            self.fraud_result_text.config(state='disabled')

    def _update_recommendation_result(self, text):
        """Update recommendation result"""
        if self.recommendation_result_text:
            self.recommendation_result_text.config(state='normal')
            self.recommendation_result_text.delete(1.0, tk.END)
            self.recommendation_result_text.insert(tk.END, text)
            self.recommendation_result_text.config(state='disabled')

    def _update_monitoring_display(self, text):
        """Update monitoring display"""
        if self.monitoring_text:
            self.monitoring_text.config(state='normal')
            self.monitoring_text.delete(1.0, tk.END)
            self.monitoring_text.insert(tk.END, text)
            self.monitoring_text.config(state='disabled')

    def destroy(self):
        """Clean up resources"""
        # Stop monitoring
        if self.monitoring_active:
            self._stop_monitoring()

        # Stop system if running
        if self.system_running:
            try:
                stop_agentic_system()
            except:
                pass

        # Destroy main frame
        if self.main_frame:
            self.main_frame.destroy()

    def get_status(self) -> Dict[str, Any]:
        """Get current panel status"""
        return {
            "system_running": self.system_running,
            "monitoring_active": self.monitoring_active,
            "agents_count": len(self.agents_status) if hasattr(self, 'agents_status') else 0
        }