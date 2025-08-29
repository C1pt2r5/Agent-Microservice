#!/usr/bin/env python3
"""
Agentic Microservices Bridge for MCP Dashboard
Provides integration between the MCP Dashboard GUI and the Agentic Microservices system
"""

import asyncio
import json
import subprocess
import threading
import time
import os
import sys
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import requests
from concurrent.futures import ThreadPoolExecutor

@dataclass
class AgentStatus:
    """Agent status information"""
    id: str
    name: str
    type: str
    status: str
    uptime: float
    memory_usage: int
    last_heartbeat: Optional[float]
    error_count: int
    request_count: int

@dataclass
class SystemMetrics:
    """System-wide metrics"""
    total_agents: int
    active_agents: int
    total_requests: int
    average_response_time: float
    system_uptime: float
    memory_usage: int

class AgenticMicroservicesBridge:
    """Bridge between MCP Dashboard and Agentic Microservices"""

    def __init__(self, project_root: str = None):
        self.project_root = project_root or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.agents: Dict[str, AgentStatus] = {}
        self.system_metrics = SystemMetrics(0, 0, 0, 0.0, 0.0, 0)
        self.is_running = False
        self.process = None
        self.executor = ThreadPoolExecutor(max_workers=4)
        self._last_metrics_update = 0

    def start_system(self) -> Dict[str, Any]:
        """Start the Agentic Microservices system"""
        try:
            if self.is_running:
                return {"success": False, "message": "System is already running"}

            # Change to project root directory
            os.chdir(self.project_root)

            # Start the interactive demo in a separate process
            self.process = subprocess.Popen(
                [sys.executable, "interactive-demo.js"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            # Wait for system to initialize
            time.sleep(3)

            # Check if process is still running
            if self.process.poll() is None:
                self.is_running = True
                self._initialize_agent_status()
                return {
                    "success": True,
                    "message": "Agentic Microservices system started successfully",
                    "agents_started": len(self.agents)
                }
            else:
                stdout, stderr = self.process.communicate()
                return {
                    "success": False,
                    "message": f"Failed to start system: {stderr}",
                    "stdout": stdout
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error starting system: {str(e)}"
            }

    def stop_system(self) -> Dict[str, Any]:
        """Stop the Agentic Microservices system"""
        try:
            if not self.is_running:
                return {"success": False, "message": "System is not running"}

            if self.process:
                # Send exit command
                try:
                    self.process.stdin.write("exit\n")
                    self.process.stdin.flush()
                    time.sleep(1)
                except:
                    pass

                # Terminate process if still running
                if self.process.poll() is None:
                    self.process.terminate()
                    time.sleep(2)
                    if self.process.poll() is None:
                        self.process.kill()

            self.is_running = False
            self.agents.clear()

            return {
                "success": True,
                "message": "Agentic Microservices system stopped successfully"
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error stopping system: {str(e)}"
            }

    def get_system_status(self) -> Dict[str, Any]:
        """Get current system status"""
        self._update_metrics()

        return {
            "is_running": self.is_running,
            "agents": [agent.__dict__ for agent in self.agents.values()],
            "metrics": {
                "total_agents": self.system_metrics.total_agents,
                "active_agents": self.system_metrics.active_agents,
                "total_requests": self.system_metrics.total_requests,
                "average_response_time": self.system_metrics.average_response_time,
                "system_uptime": self.system_metrics.system_uptime,
                "memory_usage": self.system_metrics.memory_usage
            },
            "process_info": {
                "pid": self.process.pid if self.process else None,
                "is_alive": self.process is not None and self.process.poll() is None
            }
        }

    def send_chat_message(self, message: str, session_id: str = None) -> Dict[str, Any]:
        """Send a chat message to the chatbot agent"""
        if not self.is_running or not self.process:
            return {"success": False, "message": "System is not running"}

        try:
            session = session_id or f"dashboard_session_{int(time.time())}"
            command = f"chat {message}\n"

            # Send command to process
            self.process.stdin.write(command)
            self.process.stdin.flush()

            # Wait a bit for response
            time.sleep(1)

            # For demo purposes, return a mock response
            # In a real implementation, you'd parse the actual output
            return {
                "success": True,
                "session_id": session,
                "response": {
                    "message": f"Thank you for your message: '{message}'. This is a demo response from the Agentic Chatbot.",
                    "intent": "general_support",
                    "confidence": 0.85,
                    "timestamp": time.time()
                }
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error sending chat message: {str(e)}"
            }

    def run_fraud_detection(self, transaction_amount: float = 2500.00) -> Dict[str, Any]:
        """Run fraud detection on a transaction"""
        if not self.is_running or not self.process:
            return {"success": False, "message": "System is not running"}

        try:
            command = f"fraud {transaction_amount}\n"

            # Send command to process
            self.process.stdin.write(command)
            self.process.stdin.flush()

            # Wait for response
            time.sleep(1)

            # Mock fraud detection response
            risk_level = "high" if transaction_amount > 2000 else "medium" if transaction_amount > 500 else "low"

            return {
                "success": True,
                "assessment": {
                    "risk_level": risk_level,
                    "risk_score": 0.75 if risk_level == "high" else 0.45 if risk_level == "medium" else 0.15,
                    "recommendation": "review" if risk_level in ["high", "medium"] else "approve",
                    "risk_factors": [
                        "Unusual transaction amount" if transaction_amount > 2000 else "Normal transaction pattern"
                    ],
                    "timestamp": time.time()
                }
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error running fraud detection: {str(e)}"
            }

    def get_recommendations(self, category: str = "electronics", limit: int = 3) -> Dict[str, Any]:
        """Get product recommendations"""
        if not self.is_running or not self.process:
            return {"success": False, "message": "System is not running"}

        try:
            command = f"recommend {category}\n"

            # Send command to process
            self.process.stdin.write(command)
            self.process.stdin.flush()

            # Wait for response
            time.sleep(1)

            # Mock recommendations
            mock_products = [
                {
                    "product_id": "demo_prod_001",
                    "name": "Wireless Headphones",
                    "category": category,
                    "price": 199.99,
                    "score": 0.92,
                    "features": ["wireless", "noise-cancelling"]
                },
                {
                    "product_id": "demo_prod_002",
                    "name": "Smart Watch",
                    "category": category,
                    "price": 299.99,
                    "score": 0.87,
                    "features": ["fitness-tracking", "heart-rate"]
                },
                {
                    "product_id": "demo_prod_003",
                    "name": "Bluetooth Speaker",
                    "category": category,
                    "price": 79.99,
                    "score": 0.78,
                    "features": ["portable", "waterproof"]
                }
            ]

            return {
                "success": True,
                "recommendations": mock_products[:limit],
                "total_found": len(mock_products),
                "category": category,
                "timestamp": time.time()
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error getting recommendations: {str(e)}"
            }

    def _initialize_agent_status(self):
        """Initialize agent status information"""
        self.agents = {
            "chatbot-demo": AgentStatus(
                id="chatbot-demo",
                name="Customer Support Agent",
                type="chatbot",
                status="running",
                uptime=time.time(),
                memory_usage=45,
                last_heartbeat=time.time(),
                error_count=0,
                request_count=0
            ),
            "fraud-detection-demo": AgentStatus(
                id="fraud-detection-demo",
                name="Security Agent",
                type="fraud-detection",
                status="running",
                uptime=time.time(),
                memory_usage=38,
                last_heartbeat=time.time(),
                error_count=0,
                request_count=0
            ),
            "recommendation-demo": AgentStatus(
                id="recommendation-demo",
                name="Recommendation Agent",
                type="recommendation",
                status="running",
                uptime=time.time(),
                memory_usage=52,
                last_heartbeat=time.time(),
                error_count=0,
                request_count=0
            )
        }

        self.system_metrics.total_agents = len(self.agents)
        self.system_metrics.active_agents = len(self.agents)
        self.system_metrics.system_uptime = time.time()

    def _update_metrics(self):
        """Update system metrics"""
        if not self.is_running:
            return

        current_time = time.time()

        # Update agent metrics
        for agent in self.agents.values():
            agent.uptime = current_time - agent.uptime
            agent.last_heartbeat = current_time
            # Simulate some activity
            agent.memory_usage += (current_time - self._last_metrics_update) * 0.1
            agent.request_count += int((current_time - self._last_metrics_update) * 2)

        # Update system metrics
        self.system_metrics.total_requests = sum(agent.request_count for agent in self.agents.values())
        self.system_metrics.average_response_time = 150.0  # ms
        self.system_metrics.memory_usage = sum(agent.memory_usage for agent in self.agents.values())
        self.system_metrics.system_uptime = current_time - self.system_metrics.system_uptime

        self._last_metrics_update = current_time

# Global bridge instance
_bridge_instance = None

def get_bridge() -> AgenticMicroservicesBridge:
    """Get the global bridge instance"""
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = AgenticMicroservicesBridge()
    return _bridge_instance

# Convenience functions for the dashboard
def start_agentic_system():
    """Start the Agentic Microservices system"""
    bridge = get_bridge()
    return bridge.start_system()

def stop_agentic_system():
    """Stop the Agentic Microservices system"""
    bridge = get_bridge()
    return bridge.stop_system()

def get_system_status():
    """Get current system status"""
    bridge = get_bridge()
    return bridge.get_system_status()

def send_chat(message, session_id=None):
    """Send a chat message"""
    bridge = get_bridge()
    return bridge.send_chat_message(message, session_id)

def run_fraud_check(amount=2500.00):
    """Run fraud detection"""
    bridge = get_bridge()
    return bridge.run_fraud_detection(amount)

def get_product_recommendations(category="electronics", limit=3):
    """Get product recommendations"""
    bridge = get_bridge()
    return bridge.get_recommendations(category, limit)

if __name__ == "__main__":
    # Test the bridge
    print("Testing Agentic Microservices Bridge...")

    # Start system
    result = start_agentic_system()
    print(f"Start result: {result}")

    if result.get("success"):
        # Test chat
        chat_result = send_chat("Hello, I need help")
        print(f"Chat result: {chat_result}")

        # Test fraud detection
        fraud_result = run_fraud_check(3000.00)
        print(f"Fraud result: {fraud_result}")

        # Test recommendations
        rec_result = get_product_recommendations("electronics", 2)
        print(f"Recommendations result: {rec_result}")

        # Get status
        status = get_system_status()
        print(f"System status: {status}")

        # Stop system
        stop_result = stop_agentic_system()
        print(f"Stop result: {stop_result}")

    print("Bridge test completed!")