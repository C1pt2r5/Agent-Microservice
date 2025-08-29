"""
HTTP client with retry logic and circuit breaker pattern implementation.
Handles async HTTP requests with configuration-driven behavior.
"""
import asyncio
import time
import random
import logging
from typing import Dict, Any, Optional, Callable, Union
from dataclasses import dataclass
from enum import Enum
import aiohttp
import json

from config.service_config import (
    ServiceConfig, RetryConfig, CircuitBreakerConfig, 
    RetryStrategy, AuthType
)


class CircuitBreakerState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class RequestResult:
    """Result of an HTTP request."""
    success: bool
    status_code: int
    response_data: Dict[str, Any]
    response_time: float
    error_message: Optional[str] = None
    retry_attempts: int = 0
    circuit_breaker_triggered: bool = False


class CircuitBreaker:
    """Circuit breaker implementation for HTTP requests."""
    
    def __init__(self, config: CircuitBreakerConfig):
        """Initialize circuit breaker with configuration."""
        self.config = config
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0
        self.half_open_calls = 0
        self._lock = asyncio.Lock()
    
    async def can_execute(self) -> bool:
        """Check if request can be executed based on circuit breaker state."""
        async with self._lock:
            current_time = time.time() * 1000  # Convert to milliseconds
            
            if self.state == CircuitBreakerState.CLOSED:
                return True
            
            elif self.state == CircuitBreakerState.OPEN:
                if current_time - self.last_failure_time >= self.config.recovery_timeout:
                    self.state = CircuitBreakerState.HALF_OPEN
                    self.half_open_calls = 0
                    return True
                return False
            
            elif self.state == CircuitBreakerState.HALF_OPEN:
                return self.half_open_calls < self.config.half_open_max_calls
            
            return False
    
    async def record_success(self):
        """Record a successful request."""
        async with self._lock:
            if self.state == CircuitBreakerState.HALF_OPEN:
                self.state = CircuitBreakerState.CLOSED
                self.failure_count = 0
                self.half_open_calls = 0
            elif self.state == CircuitBreakerState.CLOSED:
                self.failure_count = 0
    
    async def record_failure(self):
        """Record a failed request."""
        async with self._lock:
            current_time = time.time() * 1000  # Convert to milliseconds
            self.failure_count += 1
            self.last_failure_time = current_time
            
            if self.state == CircuitBreakerState.HALF_OPEN:
                self.state = CircuitBreakerState.OPEN
            elif self.state == CircuitBreakerState.CLOSED:
                if self.failure_count >= self.config.failure_threshold:
                    self.state = CircuitBreakerState.OPEN
            
            if self.state == CircuitBreakerState.HALF_OPEN:
                self.half_open_calls += 1


class HttpClient:
    """HTTP client with retry logic and circuit breaker pattern."""
    
    def __init__(self, service_config: ServiceConfig):
        """
        Initialize HTTP client with service configuration.
        
        Args:
            service_config: Configuration for the service
        """
        self.service_config = service_config
        self.circuit_breaker = CircuitBreaker(service_config.circuit_breaker)
        self.logger = logging.getLogger(f"HttpClient.{service_config.name}")
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
    
    async def _ensure_session(self):
        """Ensure aiohttp session is created."""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.service_config.timeout / 1000)
            self._session = aiohttp.ClientSession(timeout=timeout)
    
    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def make_request(
        self, 
        method: str, 
        endpoint: str, 
        **kwargs
    ) -> RequestResult:
        """
        Make an HTTP request with retry logic and circuit breaker.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            endpoint: API endpoint path
            **kwargs: Additional arguments for the request
            
        Returns:
            RequestResult with response data and metadata
        """
        await self._ensure_session()
        
        # Check circuit breaker
        if not await self.circuit_breaker.can_execute():
            self.logger.warning(f"Circuit breaker is OPEN for {self.service_config.name}")
            return RequestResult(
                success=False,
                status_code=503,
                response_data={},
                response_time=0,
                error_message="Circuit breaker is open",
                circuit_breaker_triggered=True
            )
        
        # Build full URL
        url = self._build_url(endpoint)
        
        # Add authentication headers
        headers = kwargs.get('headers', {})
        self._add_auth_headers(headers)
        kwargs['headers'] = headers
        
        # Execute request with retry logic
        return await self._execute_with_retry(method, url, **kwargs)
    
    def _build_url(self, endpoint: str) -> str:
        """Build full URL from service endpoint and path."""
        base_url = self.service_config.endpoint.rstrip('/')
        endpoint_path = endpoint.lstrip('/')
        return f"{base_url}/{endpoint_path}"
    
    def _add_auth_headers(self, headers: Dict[str, str]):
        """Add authentication headers based on service configuration."""
        if self.service_config.auth_type == AuthType.BEARER and self.service_config.token:
            headers['Authorization'] = f"Bearer {self.service_config.token}"
        
        elif self.service_config.auth_type == AuthType.API_KEY and self.service_config.api_key:
            headers['X-API-Key'] = self.service_config.api_key
        
        elif self.service_config.auth_type == AuthType.OAUTH2 and self.service_config.access_token:
            headers['Authorization'] = f"Bearer {self.service_config.access_token}"
    
    async def _execute_with_retry(
        self, 
        method: str, 
        url: str, 
        **kwargs
    ) -> RequestResult:
        """Execute HTTP request with retry logic."""
        retry_config = RetryConfig()  # Use default retry config for now
        last_exception = None
        
        for attempt in range(retry_config.max_attempts + 1):
            try:
                start_time = time.time()
                
                # Make the actual HTTP request
                async with self._session.request(method, url, **kwargs) as response:
                    response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
                    
                    # Read response data
                    try:
                        if response.content_type == 'application/json':
                            response_data = await response.json()
                        else:
                            text_data = await response.text()
                            response_data = {"data": text_data}
                    except Exception as e:
                        self.logger.warning(f"Failed to parse response: {e}")
                        response_data = {"error": "Failed to parse response"}
                    
                    # Check if request was successful
                    if response.status < 400:
                        await self.circuit_breaker.record_success()
                        return RequestResult(
                            success=True,
                            status_code=response.status,
                            response_data=response_data,
                            response_time=response_time,
                            retry_attempts=attempt
                        )
                    else:
                        # HTTP error status
                        error_message = f"HTTP {response.status}: {response.reason}"
                        if isinstance(response_data, dict) and 'error' in response_data:
                            error_message += f" - {response_data['error']}"
                        
                        # Don't retry on client errors (4xx)
                        if 400 <= response.status < 500:
                            await self.circuit_breaker.record_failure()
                            return RequestResult(
                                success=False,
                                status_code=response.status,
                                response_data=response_data,
                                response_time=response_time,
                                error_message=error_message,
                                retry_attempts=attempt
                            )
                        
                        # Server errors (5xx) - continue with retry logic
                        last_exception = Exception(error_message)
            
            except asyncio.TimeoutError:
                last_exception = Exception("Request timeout")
                self.logger.warning(f"Request timeout for {url} (attempt {attempt + 1})")
            
            except aiohttp.ClientError as e:
                last_exception = e
                self.logger.warning(f"Client error for {url}: {e} (attempt {attempt + 1})")
            
            except Exception as e:
                last_exception = e
                self.logger.error(f"Unexpected error for {url}: {e} (attempt {attempt + 1})")
            
            # If this was the last attempt, break
            if attempt >= retry_config.max_attempts:
                break
            
            # Calculate delay for next retry
            delay = self._calculate_retry_delay(retry_config, attempt)
            self.logger.info(f"Retrying {url} in {delay}ms (attempt {attempt + 1})")
            await asyncio.sleep(delay / 1000)  # Convert to seconds
        
        # All retries failed
        await self.circuit_breaker.record_failure()
        error_message = str(last_exception) if last_exception else "Request failed"
        
        return RequestResult(
            success=False,
            status_code=0,
            response_data={},
            response_time=0,
            error_message=error_message,
            retry_attempts=retry_config.max_attempts
        )
    
    def _calculate_retry_delay(self, retry_config: RetryConfig, attempt: int) -> int:
        """Calculate delay for retry attempt."""
        if retry_config.strategy == RetryStrategy.FIXED:
            delay = retry_config.initial_delay
        
        elif retry_config.strategy == RetryStrategy.LINEAR:
            delay = retry_config.initial_delay * (attempt + 1)
        
        elif retry_config.strategy == RetryStrategy.EXPONENTIAL:
            delay = retry_config.initial_delay * (2 ** attempt)
        
        else:
            delay = retry_config.initial_delay
        
        # Apply maximum delay limit
        delay = min(delay, retry_config.max_delay)
        
        # Add jitter if enabled
        if retry_config.jitter:
            jitter_range = delay * 0.1  # 10% jitter
            jitter = random.uniform(-jitter_range, jitter_range)
            delay = int(delay + jitter)
        
        return max(delay, 0)  # Ensure non-negative delay