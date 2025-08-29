"""
Sample endpoint definitions for MCP Dashboard services.
Provides comprehensive endpoint definitions with sample payloads and descriptions.
"""
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import json


@dataclass
class SampleEndpoint:
    """Detailed sample endpoint definition."""
    path: str
    method: str
    description: str
    category: str
    sample_payload: Optional[Dict[str, Any]] = None
    expected_response: Optional[Dict[str, Any]] = None
    parameters: Optional[Dict[str, str]] = None
    headers: Optional[Dict[str, str]] = None
    tags: Optional[List[str]] = None
    
    def __post_init__(self):
        """Initialize default values."""
        if self.tags is None:
            self.tags = []
        if self.parameters is None:
            self.parameters = {}
        if self.headers is None:
            self.headers = {}


class SampleEndpointProvider:
    """Provider for sample endpoint definitions."""
    
    def __init__(self):
        """Initialize sample endpoint provider."""
        self._endpoints_cache: Dict[str, List[SampleEndpoint]] = {}
        self._initialize_endpoints()
    
    def _initialize_endpoints(self):
        """Initialize all sample endpoints."""
        self._endpoints_cache = {
            'user-service': self._get_user_service_endpoints(),
            'transaction-service': self._get_transaction_service_endpoints(),
            'product-service': self._get_product_service_endpoints()
        }
    
    def _get_user_service_endpoints(self) -> List[SampleEndpoint]:
        """Get sample endpoints for User Service."""
        return [
            # User Management Endpoints
            SampleEndpoint(
                path="/users",
                method="GET",
                description="Get all users with optional pagination",
                category="User Management",
                parameters={
                    "page": "Page number (optional)",
                    "limit": "Number of users per page (optional)",
                    "search": "Search term for filtering users (optional)"
                },
                expected_response={
                    "users": [
                        {
                            "id": 1,
                            "name": "John Doe",
                            "email": "john.doe@example.com",
                            "age": 30,
                            "created_at": "2024-01-15T10:30:00Z",
                            "updated_at": "2024-01-15T10:30:00Z"
                        }
                    ],
                    "pagination": {
                        "page": 1,
                        "limit": 10,
                        "total": 1,
                        "total_pages": 1
                    }
                },
                tags=["users", "list", "pagination"]
            ),
            
            SampleEndpoint(
                path="/users/{id}",
                method="GET",
                description="Get a specific user by ID",
                category="User Management",
                parameters={
                    "id": "User ID (required path parameter)"
                },
                expected_response={
                    "id": 1,
                    "name": "John Doe",
                    "email": "john.doe@example.com",
                    "age": 30,
                    "profile": {
                        "bio": "Software developer",
                        "location": "New York, NY"
                    },
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-15T10:30:00Z"
                },
                tags=["users", "detail", "by-id"]
            ),
            
            SampleEndpoint(
                path="/users",
                method="POST",
                description="Create a new user",
                category="User Management",
                sample_payload={
                    "name": "Jane Smith",
                    "email": "jane.smith@example.com",
                    "age": 28,
                    "profile": {
                        "bio": "Product manager with 5 years experience",
                        "location": "San Francisco, CA"
                    }
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "id": 2,
                    "name": "Jane Smith",
                    "email": "jane.smith@example.com",
                    "age": 28,
                    "profile": {
                        "bio": "Product manager with 5 years experience",
                        "location": "San Francisco, CA"
                    },
                    "created_at": "2024-01-15T11:00:00Z",
                    "updated_at": "2024-01-15T11:00:00Z"
                },
                tags=["users", "create", "post"]
            ),
            
            SampleEndpoint(
                path="/users/{id}",
                method="PUT",
                description="Update an existing user",
                category="User Management",
                parameters={
                    "id": "User ID (required path parameter)"
                },
                sample_payload={
                    "name": "John Doe Updated",
                    "email": "john.doe.updated@example.com",
                    "age": 31,
                    "profile": {
                        "bio": "Senior software developer",
                        "location": "Boston, MA"
                    }
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "id": 1,
                    "name": "John Doe Updated",
                    "email": "john.doe.updated@example.com",
                    "age": 31,
                    "profile": {
                        "bio": "Senior software developer",
                        "location": "Boston, MA"
                    },
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-15T11:15:00Z"
                },
                tags=["users", "update", "put"]
            ),
            
            SampleEndpoint(
                path="/users/{id}",
                method="PATCH",
                description="Partially update a user",
                category="User Management",
                parameters={
                    "id": "User ID (required path parameter)"
                },
                sample_payload={
                    "age": 32,
                    "profile": {
                        "location": "Seattle, WA"
                    }
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "id": 1,
                    "name": "John Doe",
                    "email": "john.doe@example.com",
                    "age": 32,
                    "profile": {
                        "bio": "Software developer",
                        "location": "Seattle, WA"
                    },
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-15T11:30:00Z"
                },
                tags=["users", "update", "patch", "partial"]
            ),
            
            SampleEndpoint(
                path="/users/{id}",
                method="DELETE",
                description="Delete a user",
                category="User Management",
                parameters={
                    "id": "User ID (required path parameter)"
                },
                expected_response={
                    "message": "User deleted successfully",
                    "deleted_id": 1
                },
                tags=["users", "delete", "remove"]
            ),
            
            # User Profile Endpoints
            SampleEndpoint(
                path="/users/{id}/profile",
                method="GET",
                description="Get user profile details",
                category="User Profile",
                parameters={
                    "id": "User ID (required path parameter)"
                },
                expected_response={
                    "user_id": 1,
                    "bio": "Software developer",
                    "location": "New York, NY",
                    "website": "https://johndoe.dev",
                    "social_links": {
                        "twitter": "@johndoe",
                        "linkedin": "linkedin.com/in/johndoe"
                    },
                    "preferences": {
                        "theme": "dark",
                        "notifications": True
                    }
                },
                tags=["users", "profile", "details"]
            ),
            
            SampleEndpoint(
                path="/users/{id}/profile",
                method="PUT",
                description="Update user profile",
                category="User Profile",
                parameters={
                    "id": "User ID (required path parameter)"
                },
                sample_payload={
                    "bio": "Senior software developer and tech lead",
                    "location": "Austin, TX",
                    "website": "https://johndoe.tech",
                    "social_links": {
                        "twitter": "@johndoe_dev",
                        "linkedin": "linkedin.com/in/johndoe",
                        "github": "github.com/johndoe"
                    },
                    "preferences": {
                        "theme": "light",
                        "notifications": True,
                        "email_updates": False
                    }
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "user_id": 1,
                    "bio": "Senior software developer and tech lead",
                    "location": "Austin, TX",
                    "website": "https://johndoe.tech",
                    "social_links": {
                        "twitter": "@johndoe_dev",
                        "linkedin": "linkedin.com/in/johndoe",
                        "github": "github.com/johndoe"
                    },
                    "preferences": {
                        "theme": "light",
                        "notifications": True,
                        "email_updates": False
                    },
                    "updated_at": "2024-01-15T12:00:00Z"
                },
                tags=["users", "profile", "update"]
            ),
            
            # Health and Status Endpoints
            SampleEndpoint(
                path="/health",
                method="GET",
                description="Check service health status",
                category="Health & Status",
                expected_response={
                    "status": "healthy",
                    "timestamp": "2024-01-15T12:00:00Z",
                    "version": "1.0.0",
                    "uptime": "2d 5h 30m",
                    "dependencies": {
                        "database": "healthy",
                        "cache": "healthy"
                    }
                },
                tags=["health", "status", "monitoring"]
            ),
            
            SampleEndpoint(
                path="/users/search",
                method="GET",
                description="Search users by various criteria",
                category="User Search",
                parameters={
                    "q": "Search query (name, email, etc.)",
                    "age_min": "Minimum age filter",
                    "age_max": "Maximum age filter",
                    "location": "Location filter"
                },
                expected_response={
                    "results": [
                        {
                            "id": 1,
                            "name": "John Doe",
                            "email": "john.doe@example.com",
                            "age": 30,
                            "location": "New York, NY",
                            "match_score": 0.95
                        }
                    ],
                    "total_results": 1,
                    "search_time_ms": 45
                },
                tags=["users", "search", "filter"]
            )
        ]
    
    def _get_transaction_service_endpoints(self) -> List[SampleEndpoint]:
        """Get sample endpoints for Transaction Service."""
        return [
            # Transaction Management
            SampleEndpoint(
                path="/transactions",
                method="GET",
                description="Get all transactions with filtering options",
                category="Transaction Management",
                parameters={
                    "user_id": "Filter by user ID (optional)",
                    "status": "Filter by transaction status (optional)",
                    "date_from": "Start date filter (YYYY-MM-DD)",
                    "date_to": "End date filter (YYYY-MM-DD)",
                    "amount_min": "Minimum amount filter",
                    "amount_max": "Maximum amount filter",
                    "page": "Page number for pagination",
                    "limit": "Number of transactions per page"
                },
                expected_response={
                    "transactions": [
                        {
                            "id": "txn_001",
                            "user_id": 1,
                            "amount": 150.75,
                            "currency": "USD",
                            "status": "completed",
                            "type": "payment",
                            "description": "Online purchase",
                            "merchant": "Example Store",
                            "created_at": "2024-01-15T10:30:00Z",
                            "completed_at": "2024-01-15T10:30:15Z"
                        }
                    ],
                    "pagination": {
                        "page": 1,
                        "limit": 10,
                        "total": 1,
                        "total_pages": 1
                    },
                    "summary": {
                        "total_amount": 150.75,
                        "transaction_count": 1
                    }
                },
                tags=["transactions", "list", "filter"]
            ),
            
            SampleEndpoint(
                path="/transactions/{id}",
                method="GET",
                description="Get a specific transaction by ID",
                category="Transaction Management",
                parameters={
                    "id": "Transaction ID (required path parameter)"
                },
                expected_response={
                    "id": "txn_001",
                    "user_id": 1,
                    "amount": 150.75,
                    "currency": "USD",
                    "status": "completed",
                    "type": "payment",
                    "description": "Online purchase",
                    "merchant": "Example Store",
                    "payment_method": {
                        "type": "credit_card",
                        "last_four": "1234",
                        "brand": "visa"
                    },
                    "metadata": {
                        "order_id": "ord_12345",
                        "ip_address": "192.168.1.1"
                    },
                    "created_at": "2024-01-15T10:30:00Z",
                    "completed_at": "2024-01-15T10:30:15Z"
                },
                tags=["transactions", "detail", "by-id"]
            ),
            
            SampleEndpoint(
                path="/transactions",
                method="POST",
                description="Create a new transaction",
                category="Transaction Management",
                sample_payload={
                    "user_id": 1,
                    "amount": 99.99,
                    "currency": "USD",
                    "type": "payment",
                    "description": "Product purchase",
                    "merchant": "Tech Store",
                    "payment_method": {
                        "type": "credit_card",
                        "token": "card_token_12345"
                    },
                    "metadata": {
                        "order_id": "ord_67890",
                        "product_ids": ["prod_1", "prod_2"]
                    }
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "id": "txn_002",
                    "user_id": 1,
                    "amount": 99.99,
                    "currency": "USD",
                    "status": "pending",
                    "type": "payment",
                    "description": "Product purchase",
                    "merchant": "Tech Store",
                    "created_at": "2024-01-15T11:00:00Z"
                },
                tags=["transactions", "create", "payment"]
            ),
            
            SampleEndpoint(
                path="/transactions/{id}/status",
                method="PATCH",
                description="Update transaction status",
                category="Transaction Management",
                parameters={
                    "id": "Transaction ID (required path parameter)"
                },
                sample_payload={
                    "status": "completed",
                    "completion_reason": "payment_processed",
                    "notes": "Payment successfully processed"
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "id": "txn_002",
                    "status": "completed",
                    "previous_status": "pending",
                    "updated_at": "2024-01-15T11:05:00Z",
                    "completion_reason": "payment_processed"
                },
                tags=["transactions", "status", "update"]
            ),
            
            SampleEndpoint(
                path="/transactions/{id}/refund",
                method="POST",
                description="Process a refund for a transaction",
                category="Transaction Management",
                parameters={
                    "id": "Transaction ID (required path parameter)"
                },
                sample_payload={
                    "amount": 50.00,
                    "reason": "partial_refund",
                    "description": "Refund for returned item"
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "refund_id": "ref_001",
                    "transaction_id": "txn_001",
                    "amount": 50.00,
                    "currency": "USD",
                    "status": "processing",
                    "reason": "partial_refund",
                    "description": "Refund for returned item",
                    "created_at": "2024-01-15T11:30:00Z"
                },
                tags=["transactions", "refund", "process"]
            ),
            
            # Analytics and Reporting
            SampleEndpoint(
                path="/transactions/analytics/summary",
                method="GET",
                description="Get transaction analytics summary",
                category="Analytics",
                parameters={
                    "period": "Time period (day, week, month, year)",
                    "user_id": "Filter by specific user (optional)",
                    "currency": "Filter by currency (optional)"
                },
                expected_response={
                    "period": "month",
                    "date_range": {
                        "start": "2024-01-01",
                        "end": "2024-01-31"
                    },
                    "summary": {
                        "total_transactions": 1250,
                        "total_amount": 125000.50,
                        "average_amount": 100.00,
                        "successful_transactions": 1200,
                        "failed_transactions": 50,
                        "success_rate": 96.0
                    },
                    "by_status": {
                        "completed": 1200,
                        "pending": 25,
                        "failed": 25
                    },
                    "by_type": {
                        "payment": 1100,
                        "refund": 100,
                        "transfer": 50
                    }
                },
                tags=["transactions", "analytics", "summary"]
            ),
            
            # Health Check
            SampleEndpoint(
                path="/health",
                method="GET",
                description="Check transaction service health",
                category="Health & Status",
                expected_response={
                    "status": "healthy",
                    "timestamp": "2024-01-15T12:00:00Z",
                    "version": "2.1.0",
                    "uptime": "5d 12h 45m",
                    "dependencies": {
                        "database": "healthy",
                        "payment_gateway": "healthy",
                        "cache": "healthy"
                    },
                    "metrics": {
                        "transactions_per_minute": 45,
                        "average_response_time_ms": 120
                    }
                },
                tags=["health", "status", "monitoring"]
            )
        ]
    
    def _get_product_service_endpoints(self) -> List[SampleEndpoint]:
        """Get sample endpoints for Product Service."""
        return [
            # Product Management
            SampleEndpoint(
                path="/products",
                method="GET",
                description="Get all products with filtering and pagination",
                category="Product Management",
                parameters={
                    "category": "Filter by product category",
                    "price_min": "Minimum price filter",
                    "price_max": "Maximum price filter",
                    "in_stock": "Filter by stock availability (true/false)",
                    "search": "Search in product name and description",
                    "sort": "Sort by (name, price, created_at, popularity)",
                    "order": "Sort order (asc, desc)",
                    "page": "Page number for pagination",
                    "limit": "Number of products per page"
                },
                expected_response={
                    "products": [
                        {
                            "id": "prod_001",
                            "name": "Wireless Headphones",
                            "description": "High-quality wireless headphones with noise cancellation",
                            "price": 199.99,
                            "currency": "USD",
                            "category": "Electronics",
                            "brand": "TechBrand",
                            "sku": "WH-001",
                            "stock_quantity": 50,
                            "in_stock": True,
                            "images": [
                                "https://example.com/images/wh-001-1.jpg",
                                "https://example.com/images/wh-001-2.jpg"
                            ],
                            "rating": 4.5,
                            "review_count": 128,
                            "created_at": "2024-01-10T09:00:00Z",
                            "updated_at": "2024-01-15T10:30:00Z"
                        }
                    ],
                    "pagination": {
                        "page": 1,
                        "limit": 10,
                        "total": 1,
                        "total_pages": 1
                    },
                    "filters_applied": {
                        "category": "Electronics",
                        "in_stock": True
                    }
                },
                tags=["products", "list", "filter", "pagination"]
            ),
            
            SampleEndpoint(
                path="/products/{id}",
                method="GET",
                description="Get a specific product by ID",
                category="Product Management",
                parameters={
                    "id": "Product ID (required path parameter)"
                },
                expected_response={
                    "id": "prod_001",
                    "name": "Wireless Headphones",
                    "description": "High-quality wireless headphones with noise cancellation",
                    "long_description": "Experience premium sound quality with our latest wireless headphones featuring advanced noise cancellation technology, 30-hour battery life, and comfortable over-ear design.",
                    "price": 199.99,
                    "currency": "USD",
                    "category": "Electronics",
                    "subcategory": "Audio",
                    "brand": "TechBrand",
                    "sku": "WH-001",
                    "stock_quantity": 50,
                    "in_stock": True,
                    "dimensions": {
                        "length": 20.5,
                        "width": 18.0,
                        "height": 8.5,
                        "unit": "cm"
                    },
                    "weight": {
                        "value": 250,
                        "unit": "g"
                    },
                    "specifications": {
                        "battery_life": "30 hours",
                        "connectivity": "Bluetooth 5.0",
                        "noise_cancellation": True,
                        "warranty": "2 years"
                    },
                    "images": [
                        "https://example.com/images/wh-001-1.jpg",
                        "https://example.com/images/wh-001-2.jpg",
                        "https://example.com/images/wh-001-3.jpg"
                    ],
                    "rating": 4.5,
                    "review_count": 128,
                    "tags": ["wireless", "noise-cancelling", "premium"],
                    "created_at": "2024-01-10T09:00:00Z",
                    "updated_at": "2024-01-15T10:30:00Z"
                },
                tags=["products", "detail", "by-id"]
            ),
            
            SampleEndpoint(
                path="/products",
                method="POST",
                description="Create a new product",
                category="Product Management",
                sample_payload={
                    "name": "Smart Watch Pro",
                    "description": "Advanced smartwatch with health monitoring",
                    "long_description": "Stay connected and monitor your health with our latest smartwatch featuring GPS, heart rate monitoring, sleep tracking, and 7-day battery life.",
                    "price": 299.99,
                    "currency": "USD",
                    "category": "Electronics",
                    "subcategory": "Wearables",
                    "brand": "TechBrand",
                    "sku": "SW-PRO-001",
                    "stock_quantity": 100,
                    "dimensions": {
                        "length": 4.5,
                        "width": 4.0,
                        "height": 1.2,
                        "unit": "cm"
                    },
                    "weight": {
                        "value": 45,
                        "unit": "g"
                    },
                    "specifications": {
                        "battery_life": "7 days",
                        "water_resistance": "50m",
                        "gps": True,
                        "heart_rate_monitor": True,
                        "warranty": "1 year"
                    },
                    "tags": ["smartwatch", "fitness", "gps", "health"]
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "id": "prod_002",
                    "name": "Smart Watch Pro",
                    "description": "Advanced smartwatch with health monitoring",
                    "price": 299.99,
                    "currency": "USD",
                    "category": "Electronics",
                    "brand": "TechBrand",
                    "sku": "SW-PRO-001",
                    "stock_quantity": 100,
                    "in_stock": True,
                    "created_at": "2024-01-15T11:00:00Z",
                    "updated_at": "2024-01-15T11:00:00Z"
                },
                tags=["products", "create", "post"]
            ),
            
            SampleEndpoint(
                path="/products/{id}",
                method="PUT",
                description="Update an existing product",
                category="Product Management",
                parameters={
                    "id": "Product ID (required path parameter)"
                },
                sample_payload={
                    "name": "Wireless Headphones Pro",
                    "description": "Premium wireless headphones with advanced noise cancellation",
                    "price": 249.99,
                    "stock_quantity": 75,
                    "specifications": {
                        "battery_life": "35 hours",
                        "connectivity": "Bluetooth 5.2",
                        "noise_cancellation": True,
                        "warranty": "3 years"
                    }
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "id": "prod_001",
                    "name": "Wireless Headphones Pro",
                    "description": "Premium wireless headphones with advanced noise cancellation",
                    "price": 249.99,
                    "currency": "USD",
                    "category": "Electronics",
                    "brand": "TechBrand",
                    "sku": "WH-001",
                    "stock_quantity": 75,
                    "in_stock": True,
                    "updated_at": "2024-01-15T11:15:00Z"
                },
                tags=["products", "update", "put"]
            ),
            
            SampleEndpoint(
                path="/products/{id}/inventory",
                method="PATCH",
                description="Update product inventory",
                category="Inventory Management",
                parameters={
                    "id": "Product ID (required path parameter)"
                },
                sample_payload={
                    "stock_quantity": 25,
                    "operation": "set",
                    "reason": "inventory_adjustment",
                    "notes": "Physical inventory count adjustment"
                },
                headers={
                    "Content-Type": "application/json"
                },
                expected_response={
                    "product_id": "prod_001",
                    "previous_quantity": 50,
                    "new_quantity": 25,
                    "operation": "set",
                    "reason": "inventory_adjustment",
                    "updated_at": "2024-01-15T11:30:00Z"
                },
                tags=["products", "inventory", "stock"]
            ),
            
            # Category Management
            SampleEndpoint(
                path="/categories",
                method="GET",
                description="Get all product categories",
                category="Category Management",
                expected_response={
                    "categories": [
                        {
                            "id": "cat_001",
                            "name": "Electronics",
                            "description": "Electronic devices and accessories",
                            "parent_id": None,
                            "subcategories": [
                                {
                                    "id": "cat_002",
                                    "name": "Audio",
                                    "description": "Audio devices and accessories"
                                },
                                {
                                    "id": "cat_003",
                                    "name": "Wearables",
                                    "description": "Wearable technology devices"
                                }
                            ],
                            "product_count": 150,
                            "created_at": "2024-01-01T00:00:00Z"
                        }
                    ]
                },
                tags=["categories", "list", "hierarchy"]
            ),
            
            # Search and Recommendations
            SampleEndpoint(
                path="/products/search",
                method="GET",
                description="Search products with advanced filtering",
                category="Search & Discovery",
                parameters={
                    "q": "Search query",
                    "category": "Category filter",
                    "brand": "Brand filter",
                    "price_range": "Price range (e.g., 100-500)",
                    "rating_min": "Minimum rating filter",
                    "features": "Feature filters (comma-separated)"
                },
                expected_response={
                    "query": "wireless headphones",
                    "results": [
                        {
                            "id": "prod_001",
                            "name": "Wireless Headphones",
                            "price": 199.99,
                            "category": "Electronics",
                            "brand": "TechBrand",
                            "rating": 4.5,
                            "match_score": 0.95,
                            "highlight": {
                                "name": "<em>Wireless Headphones</em>",
                                "description": "High-quality <em>wireless</em> <em>headphones</em>"
                            }
                        }
                    ],
                    "total_results": 1,
                    "search_time_ms": 25,
                    "suggestions": ["wireless earbuds", "bluetooth headphones"],
                    "filters_applied": {
                        "category": "Electronics"
                    }
                },
                tags=["products", "search", "filter", "recommendations"]
            ),
            
            # Health Check
            SampleEndpoint(
                path="/health",
                method="GET",
                description="Check product service health",
                category="Health & Status",
                expected_response={
                    "status": "healthy",
                    "timestamp": "2024-01-15T12:00:00Z",
                    "version": "1.5.2",
                    "uptime": "10d 3h 20m",
                    "dependencies": {
                        "database": "healthy",
                        "search_engine": "healthy",
                        "image_storage": "healthy",
                        "cache": "healthy"
                    },
                    "metrics": {
                        "total_products": 5420,
                        "categories": 25,
                        "average_response_time_ms": 85
                    }
                },
                tags=["health", "status", "monitoring"]
            )
        ]
    
    def get_endpoints_for_service(self, service_name: str) -> List[SampleEndpoint]:
        """
        Get sample endpoints for a specific service.
        
        Args:
            service_name: Name of the service
            
        Returns:
            List of SampleEndpoint objects
        """
        return self._endpoints_cache.get(service_name, [])
    
    def get_all_services(self) -> List[str]:
        """
        Get list of all services with sample endpoints.
        
        Returns:
            List of service names
        """
        return list(self._endpoints_cache.keys())
    
    def get_endpoints_by_category(self, service_name: str, category: str) -> List[SampleEndpoint]:
        """
        Get endpoints filtered by category.
        
        Args:
            service_name: Name of the service
            category: Category to filter by
            
        Returns:
            List of SampleEndpoint objects in the specified category
        """
        endpoints = self.get_endpoints_for_service(service_name)
        return [ep for ep in endpoints if ep.category == category]
    
    def get_categories_for_service(self, service_name: str) -> List[str]:
        """
        Get all categories for a service.
        
        Args:
            service_name: Name of the service
            
        Returns:
            List of category names
        """
        endpoints = self.get_endpoints_for_service(service_name)
        categories = set(ep.category for ep in endpoints)
        return sorted(list(categories))
    
    def search_endpoints(self, service_name: str, query: str) -> List[SampleEndpoint]:
        """
        Search endpoints by query.
        
        Args:
            service_name: Name of the service
            query: Search query
            
        Returns:
            List of matching SampleEndpoint objects
        """
        endpoints = self.get_endpoints_for_service(service_name)
        query_lower = query.lower()
        
        matches = []
        for endpoint in endpoints:
            if (query_lower in endpoint.path.lower() or 
                query_lower in endpoint.description.lower() or
                query_lower in endpoint.method.lower() or
                any(query_lower in tag.lower() for tag in endpoint.tags)):
                matches.append(endpoint)
        
        return matches


# Global instance
_sample_endpoint_provider: Optional[SampleEndpointProvider] = None


def get_sample_endpoint_provider() -> SampleEndpointProvider:
    """Get the global sample endpoint provider instance."""
    global _sample_endpoint_provider
    
    if _sample_endpoint_provider is None:
        _sample_endpoint_provider = SampleEndpointProvider()
    
    return _sample_endpoint_provider