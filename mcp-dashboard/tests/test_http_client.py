"""
Unit tests for HTTP client with retry logic and circuit breaker.
"""
import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch
import aiohttp

from services.http_client import HttpClient, CircuitBreaker, CircuitBreakerState, RequestResult
from config.service_config import (
    ServiceConfig, RetryConfig, CircuitBreakerConfig, 
    RetryStrategy, AuthType
)


class TestCircuitBreaker:
    """Test cases for CircuitBreaker class."""
    
    def test_circuit_breaker_init(self):
        """Test circuit breaker initialization."""
        config = CircuitBreakerConfig(
            failure_threshold=3,
            recovery_timeout=5000,
            half_open_max_calls=2
        )
        cb = CircuitBreaker(config)
        
        assert cb.config == config
        assert cb.state == CircuitBreakerState.CLOSED
        assert cb.failure_count == 0
        assert cb.half_open_calls == 0
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_closed_state(self):
        """Test circuit breaker in closed state."""
        config = CircuitBreakerConfig()
        cb = CircuitBreaker(config)
        
        assert await cb.can_execute() is True
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_open_state(self):
        """Test circuit breaker in open state."""
        config = CircuitBreakerConfig(failure_threshold=2, recovery_timeout=1000)
        cb = CircuitBreaker(config)
        
        # Trigger failures to open circuit
        await cb.record_failure()
        await cb.record_failure()
        
        assert cb.state == CircuitBreakerState.OPEN
        assert await cb.can_execute() is False
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_half_open_transition(self):
        """Test circuit breaker transition to half-open state."""
        config = CircuitBreakerConfig(failure_threshold=1, recovery_timeout=100)
        cb = CircuitBreaker(config)
        
        # Open the circuit
        await cb.record_failure()
        assert cb.state == CircuitBreakerState.OPEN
        
        # Wait for recovery timeout
        await asyncio.sleep(0.15)  # 150ms > 100ms recovery timeout
        
        # Should transition to half-open
        assert await cb.can_execute() is True
        assert cb.state == CircuitBreakerState.HALF_OPEN
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_success_recovery(self):
        """Test circuit breaker recovery on success."""
        config = CircuitBreakerConfig(failure_threshold=1, recovery_timeout=100)
        cb = CircuitBreaker(config)
        
        # Open the circuit
        await cb.record_failure()
        await asyncio.sleep(0.15)
        await cb.can_execute()  # Transition to half-open
        
        # Record success should close circuit
        await cb.record_success()
        assert cb.state == CircuitBreakerState.CLOSED
        assert cb.failure_count == 0


class TestHttpClient:
    """Test cases for HttpClient class."""
    
    def create_test_service_config(self, **overrides):
        """Create a test service configuration."""
        defaults = {
            'name': 'test-service',
            'endpoint': 'http://localhost:8080/api',
            'auth_type': AuthType.NONE,
            'timeout': 5000,
            'circuit_breaker': CircuitBreakerConfig(),
        }
        defaults.update(overrides)
        return ServiceConfig(**defaults)
    
    @pytest.mark.asyncio
    async def test_http_client_init(self):
        """Test HTTP client initialization."""
        service_config = self.create_test_service_config()
        
        async with HttpClient(service_config) as client:
            assert client.service_config == service_config
            assert client.circuit_breaker is not None
            assert client._session is not None
    
    @pytest.mark.asyncio
    async def test_build_url(self):
        """Test URL building."""
        service_config = self.create_test_service_config(
            endpoint='http://localhost:8080/api'
        )
        
        async with HttpClient(service_config) as client:
            url = client._build_url('/users')
            assert url == 'http://localhost:8080/api/users'
            
            url = client._build_url('users')
            assert url == 'http://localhost:8080/api/users'
    
    def test_add_auth_headers_bearer(self):
        """Test adding bearer token authentication headers."""
        service_config = self.create_test_service_config(
            auth_type=AuthType.BEARER,
            token='test-token'
        )
        
        client = HttpClient(service_config)
        headers = {}
        client._add_auth_headers(headers)
        
        assert headers['Authorization'] == 'Bearer test-token'
    
    def test_add_auth_headers_api_key(self):
        """Test adding API key authentication headers."""
        service_config = self.create_test_service_config(
            auth_type=AuthType.API_KEY,
            api_key='test-api-key'
        )
        
        client = HttpClient(service_config)
        headers = {}
        client._add_auth_headers(headers)
        
        assert headers['X-API-Key'] == 'test-api-key'
    
    def test_add_auth_headers_oauth2(self):
        """Test adding OAuth2 authentication headers."""
        service_config = self.create_test_service_config(
            auth_type=AuthType.OAUTH2,
            access_token='test-access-token'
        )
        
        client = HttpClient(service_config)
        headers = {}
        client._add_auth_headers(headers)
        
        assert headers['Authorization'] == 'Bearer test-access-token'
    
    def test_calculate_retry_delay_fixed(self):
        """Test fixed retry delay calculation."""
        service_config = self.create_test_service_config()
        client = HttpClient(service_config)
        
        retry_config = RetryConfig(
            strategy=RetryStrategy.FIXED,
            initial_delay=1000,
            jitter=False
        )
        
        delay = client._calculate_retry_delay(retry_config, 0)
        assert delay == 1000
        
        delay = client._calculate_retry_delay(retry_config, 2)
        assert delay == 1000
    
    def test_calculate_retry_delay_linear(self):
        """Test linear retry delay calculation."""
        service_config = self.create_test_service_config()
        client = HttpClient(service_config)
        
        retry_config = RetryConfig(
            strategy=RetryStrategy.LINEAR,
            initial_delay=1000,
            jitter=False
        )
        
        delay = client._calculate_retry_delay(retry_config, 0)
        assert delay == 1000
        
        delay = client._calculate_retry_delay(retry_config, 1)
        assert delay == 2000
        
        delay = client._calculate_retry_delay(retry_config, 2)
        assert delay == 3000
    
    def test_calculate_retry_delay_exponential(self):
        """Test exponential retry delay calculation."""
        service_config = self.create_test_service_config()
        client = HttpClient(service_config)
        
        retry_config = RetryConfig(
            strategy=RetryStrategy.EXPONENTIAL,
            initial_delay=1000,
            jitter=False
        )
        
        delay = client._calculate_retry_delay(retry_config, 0)
        assert delay == 1000
        
        delay = client._calculate_retry_delay(retry_config, 1)
        assert delay == 2000
        
        delay = client._calculate_retry_delay(retry_config, 2)
        assert delay == 4000
    
    def test_calculate_retry_delay_max_limit(self):
        """Test retry delay maximum limit."""
        service_config = self.create_test_service_config()
        client = HttpClient(service_config)
        
        retry_config = RetryConfig(
            strategy=RetryStrategy.EXPONENTIAL,
            initial_delay=1000,
            max_delay=5000,
            jitter=False
        )
        
        delay = client._calculate_retry_delay(retry_config, 10)  # Would be 1024000 without limit
        assert delay == 5000
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_blocks_request(self):
        """Test that circuit breaker blocks requests when open."""
        service_config = self.create_test_service_config()
        
        async with HttpClient(service_config) as client:
            # Manually open circuit breaker by setting state and failure time
            async with client.circuit_breaker._lock:
                client.circuit_breaker.state = CircuitBreakerState.OPEN
                client.circuit_breaker.last_failure_time = time.time() * 1000  # Current time in ms
            
            result = await client.make_request('GET', '/test')
            
            assert result.success is False
            assert result.status_code == 503
            assert result.circuit_breaker_triggered is True
            assert "Circuit breaker is open" in result.error_message
    
    @pytest.mark.asyncio
    @patch('aiohttp.ClientSession.request')
    async def test_successful_request(self, mock_request):
        """Test successful HTTP request."""
        # Mock successful response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.content_type = 'application/json'
        mock_response.json.return_value = {'data': 'test'}
        mock_request.return_value.__aenter__.return_value = mock_response
        
        service_config = self.create_test_service_config()
        
        async with HttpClient(service_config) as client:
            result = await client.make_request('GET', '/test')
            
            assert result.success is True
            assert result.status_code == 200
            assert result.response_data == {'data': 'test'}
            assert result.retry_attempts == 0
    
    @pytest.mark.asyncio
    @patch('aiohttp.ClientSession.request')
    async def test_client_error_no_retry(self, mock_request):
        """Test that client errors (4xx) are not retried."""
        # Mock 404 response
        mock_response = AsyncMock()
        mock_response.status = 404
        mock_response.reason = 'Not Found'
        mock_response.content_type = 'application/json'
        mock_response.json.return_value = {'error': 'Resource not found'}
        mock_request.return_value.__aenter__.return_value = mock_response
        
        service_config = self.create_test_service_config()
        
        async with HttpClient(service_config) as client:
            result = await client.make_request('GET', '/test')
            
            assert result.success is False
            assert result.status_code == 404
            assert result.retry_attempts == 0
            assert "HTTP 404: Not Found" in result.error_message
    
    @pytest.mark.asyncio
    @patch('aiohttp.ClientSession.request')
    async def test_timeout_error(self, mock_request):
        """Test timeout error handling."""
        # Mock timeout
        mock_request.side_effect = asyncio.TimeoutError()
        
        service_config = self.create_test_service_config()
        
        async with HttpClient(service_config) as client:
            # Patch retry config to avoid long test times
            with patch.object(client, '_calculate_retry_delay', return_value=10):
                result = await client.make_request('GET', '/test')
                
                assert result.success is False
                assert result.status_code == 0
                assert "Request timeout" in result.error_message
                assert result.retry_attempts > 0


if __name__ == '__main__':
    pytest.main([__file__])