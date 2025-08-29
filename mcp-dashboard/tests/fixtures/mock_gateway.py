"""
Mock MCP Gateway for consistent testing.
Provides a mock HTTP server that simulates the MCP Gateway behavior.
"""
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from aiohttp import web, ClientSession
from aiohttp.test_utils import TestServer, TestClient
import time
import random


class MockMCPGateway:
    """Mock MCP Gateway server for testing."""
    
    def __init__(self, port: int = 8080):
        """Initialize mock gateway."""
        self.port = port
        self.app = web.Application()
        self.server: Optional[TestServer] = None
        self.client: Optional[TestClient] = None
        self.request_log: List[Dict[str, Any]] = []
        self.response_delays: Dict[str, float] = {}
        self.failure_rates: Dict[str, float] = {}
        self.custom_responses: Dict[str, Dict[str, Any]] = {}
        self.circuit_breaker_states: Dict[str, bool] = {}
        
        self._setup_routes()
        self.logger = logging.getLogger("MockMCPGateway")
    
    def _setup_routes(self):
        """Set up mock routes."""
        # Health endpoints
        self.app.router.add_get('/health', self._health_handler)
        self.app.router.add_get('/status', self._status_handler)
        
        # User service endpoints
        self.app.router.add_get('/api/users', self._get_users_handler)
        self.app.router.add_get('/api/users/{user_id}', self._get_user_handler)
        self.app.router.add_post('/api/users', self._create_user_handler)
        self.app.router.add_put('/api/users/{user_id}', self._update_user_handler)
        self.app.router.add_delete('/api/users/{user_id}', self._delete_user_handler)
        
        # Transaction service endpoints
        self.app.router.add_get('/api/transactions', self._get_transactions_handler)
        self.app.router.add_get('/api/transactions/{transaction_id}', self._get_transaction_handler)
        self.app.router.add_post('/api/transactions', self._create_transaction_handler)
        
        # Product service endpoints
        self.app.router.add_get('/api/products', self._get_products_handler)
        self.app.router.add_get('/api/products/{product_id}', self._get_product_handler)
        self.app.router.add_post('/api/products', self._create_product_handler)
        
        # Generic catch-all for testing
        self.app.router.add_route('*', '/{path:.*}', self._generic_handler)
    
    async def start(self):
        """Start the mock server."""
        self.server = TestServer(self.app, port=self.port)
        await self.server.start_server()
        self.client = TestClient(self.server, loop=asyncio.get_event_loop())
        self.logger.info(f"Mock MCP Gateway started on port {self.port}")
    
    async def stop(self):
        """Stop the mock server."""
        if self.client:
            await self.client.close()
        if self.server:
            await self.server.close()
        self.logger.info("Mock MCP Gateway stopped")
    
    def set_response_delay(self, endpoint: str, delay: float):
        """Set artificial delay for specific endpoint."""
        self.response_delays[endpoint] = delay
    
    def set_failure_rate(self, endpoint: str, rate: float):
        """Set failure rate for specific endpoint (0.0 to 1.0)."""
        self.failure_rates[endpoint] = rate
    
    def set_custom_response(self, endpoint: str, method: str, response: Dict[str, Any]):
        """Set custom response for specific endpoint and method."""
        key = f"{method.upper()} {endpoint}"
        self.custom_responses[key] = response
    
    def set_circuit_breaker_open(self, service: str, is_open: bool = True):
        """Simulate circuit breaker state for a service."""
        self.circuit_breaker_states[service] = is_open
    
    def get_request_log(self) -> List[Dict[str, Any]]:
        """Get log of all requests made to the mock gateway."""
        return self.request_log.copy()
    
    def clear_request_log(self):
        """Clear the request log."""
        self.request_log.clear()
    
    async def _log_request(self, request: web.Request):
        """Log incoming request."""
        body = None
        if request.can_read_body:
            try:
                body = await request.text()
                if body:
                    body = json.loads(body)
            except:
                body = await request.text()
        
        log_entry = {
            'timestamp': time.time(),
            'method': request.method,
            'path': request.path,
            'query': dict(request.query),
            'headers': dict(request.headers),
            'body': body
        }
        self.request_log.append(log_entry)
    
    async def _apply_delays_and_failures(self, request: web.Request):
        """Apply configured delays and simulate failures."""
        endpoint = request.path
        
        # Apply delay if configured
        if endpoint in self.response_delays:
            await asyncio.sleep(self.response_delays[endpoint])
        
        # Simulate failure if configured
        if endpoint in self.failure_rates:
            if random.random() < self.failure_rates[endpoint]:
                raise web.HTTPInternalServerError(text="Simulated failure")
    
    async def _check_custom_response(self, request: web.Request):
        """Check if there's a custom response configured."""
        key = f"{request.method.upper()} {request.path}"
        if key in self.custom_responses:
            response_config = self.custom_responses[key]
            status = response_config.get('status', 200)
            data = response_config.get('data', {})
            headers = response_config.get('headers', {})
            
            return web.json_response(data, status=status, headers=headers)
        return None
    
    # Health endpoints
    async def _health_handler(self, request: web.Request):
        """Handle health check requests."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        custom_response = await self._check_custom_response(request)
        if custom_response:
            return custom_response
        
        return web.json_response({
            'status': 'healthy',
            'timestamp': time.time(),
            'services': {
                'user-service': 'up',
                'transaction-service': 'up',
                'product-service': 'up'
            }
        })
    
    async def _status_handler(self, request: web.Request):
        """Handle status check requests."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        return web.json_response({
            'status': 'operational',
            'version': '1.0.0',
            'uptime': 3600
        })
    
    # User service endpoints
    async def _get_users_handler(self, request: web.Request):
        """Handle get users request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        custom_response = await self._check_custom_response(request)
        if custom_response:
            return custom_response
        
        # Simulate pagination
        page = int(request.query.get('page', 1))
        limit = int(request.query.get('limit', 10))
        
        users = [
            {
                'id': i,
                'name': f'User {i}',
                'email': f'user{i}@example.com',
                'age': 20 + (i % 50),
                'active': i % 3 != 0
            }
            for i in range((page - 1) * limit + 1, page * limit + 1)
        ]
        
        return web.json_response({
            'users': users,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': 100,
                'pages': 10
            }
        })
    
    async def _get_user_handler(self, request: web.Request):
        """Handle get specific user request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        user_id = int(request.match_info['user_id'])
        
        if user_id > 100:
            raise web.HTTPNotFound(text=json.dumps({'error': 'User not found'}))
        
        return web.json_response({
            'id': user_id,
            'name': f'User {user_id}',
            'email': f'user{user_id}@example.com',
            'age': 20 + (user_id % 50),
            'active': user_id % 3 != 0,
            'profile': {
                'bio': f'This is user {user_id}',
                'location': 'Test City',
                'joined': '2023-01-01'
            }
        })
    
    async def _create_user_handler(self, request: web.Request):
        """Handle create user request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        try:
            data = await request.json()
        except:
            raise web.HTTPBadRequest(text=json.dumps({'error': 'Invalid JSON'}))
        
        # Validate required fields
        if not data.get('name') or not data.get('email'):
            raise web.HTTPBadRequest(text=json.dumps({
                'error': 'Missing required fields: name, email'
            }))
        
        # Simulate user creation
        new_user = {
            'id': random.randint(101, 999),
            'name': data['name'],
            'email': data['email'],
            'age': data.get('age', 25),
            'active': True,
            'created_at': time.time()
        }
        
        return web.json_response(new_user, status=201)
    
    async def _update_user_handler(self, request: web.Request):
        """Handle update user request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        user_id = int(request.match_info['user_id'])
        
        try:
            data = await request.json()
        except:
            raise web.HTTPBadRequest(text=json.dumps({'error': 'Invalid JSON'}))
        
        if user_id > 100:
            raise web.HTTPNotFound(text=json.dumps({'error': 'User not found'}))
        
        updated_user = {
            'id': user_id,
            'name': data.get('name', f'User {user_id}'),
            'email': data.get('email', f'user{user_id}@example.com'),
            'age': data.get('age', 25),
            'active': data.get('active', True),
            'updated_at': time.time()
        }
        
        return web.json_response(updated_user)
    
    async def _delete_user_handler(self, request: web.Request):
        """Handle delete user request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        user_id = int(request.match_info['user_id'])
        
        if user_id > 100:
            raise web.HTTPNotFound(text=json.dumps({'error': 'User not found'}))
        
        return web.json_response({'message': f'User {user_id} deleted'}, status=204)
    
    # Transaction service endpoints
    async def _get_transactions_handler(self, request: web.Request):
        """Handle get transactions request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        transactions = [
            {
                'id': f'txn_{i}',
                'amount': round(random.uniform(10.0, 1000.0), 2),
                'currency': 'USD',
                'userId': random.randint(1, 100),
                'status': random.choice(['pending', 'completed', 'failed']),
                'timestamp': time.time() - (i * 3600)
            }
            for i in range(1, 11)
        ]
        
        return web.json_response({'transactions': transactions})
    
    async def _get_transaction_handler(self, request: web.Request):
        """Handle get specific transaction request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        transaction_id = request.match_info['transaction_id']
        
        return web.json_response({
            'id': transaction_id,
            'amount': 150.75,
            'currency': 'USD',
            'userId': 42,
            'status': 'completed',
            'timestamp': time.time(),
            'details': {
                'description': 'Test transaction',
                'merchant': 'Test Store'
            }
        })
    
    async def _create_transaction_handler(self, request: web.Request):
        """Handle create transaction request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        try:
            data = await request.json()
        except:
            raise web.HTTPBadRequest(text=json.dumps({'error': 'Invalid JSON'}))
        
        new_transaction = {
            'id': f'txn_{random.randint(1000, 9999)}',
            'amount': data.get('amount', 0),
            'currency': data.get('currency', 'USD'),
            'userId': data.get('userId'),
            'status': 'pending',
            'timestamp': time.time()
        }
        
        return web.json_response(new_transaction, status=201)
    
    # Product service endpoints
    async def _get_products_handler(self, request: web.Request):
        """Handle get products request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        products = [
            {
                'id': i,
                'name': f'Product {i}',
                'price': round(random.uniform(10.0, 500.0), 2),
                'category': random.choice(['Electronics', 'Clothing', 'Books', 'Home']),
                'inStock': random.choice([True, False]),
                'description': f'This is product {i}'
            }
            for i in range(1, 21)
        ]
        
        return web.json_response({'products': products})
    
    async def _get_product_handler(self, request: web.Request):
        """Handle get specific product request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        product_id = int(request.match_info['product_id'])
        
        return web.json_response({
            'id': product_id,
            'name': f'Product {product_id}',
            'price': 99.99,
            'category': 'Electronics',
            'inStock': True,
            'description': f'Detailed description of product {product_id}',
            'specifications': {
                'weight': '1.5kg',
                'dimensions': '30x20x10cm',
                'color': 'Black'
            }
        })
    
    async def _create_product_handler(self, request: web.Request):
        """Handle create product request."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        try:
            data = await request.json()
        except:
            raise web.HTTPBadRequest(text=json.dumps({'error': 'Invalid JSON'}))
        
        new_product = {
            'id': random.randint(1000, 9999),
            'name': data.get('name', 'New Product'),
            'price': data.get('price', 0),
            'category': data.get('category', 'General'),
            'inStock': data.get('inStock', True),
            'description': data.get('description', ''),
            'created_at': time.time()
        }
        
        return web.json_response(new_product, status=201)
    
    async def _generic_handler(self, request: web.Request):
        """Handle any other requests."""
        await self._log_request(request)
        await self._apply_delays_and_failures(request)
        
        custom_response = await self._check_custom_response(request)
        if custom_response:
            return custom_response
        
        # Return 404 for unhandled endpoints
        return web.json_response(
            {'error': f'Endpoint not found: {request.method} {request.path}'},
            status=404
        )


# Convenience functions for testing
async def create_mock_gateway(port: int = 8080) -> MockMCPGateway:
    """Create and start a mock MCP Gateway."""
    gateway = MockMCPGateway(port)
    await gateway.start()
    return gateway


async def cleanup_mock_gateway(gateway: MockMCPGateway):
    """Stop and cleanup a mock MCP Gateway."""
    await gateway.stop()