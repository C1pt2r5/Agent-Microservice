/**
 * MCP client implementation
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { 
  MCPClient, 
  MCPRequest, 
  MCPResponse, 
  MCPServiceDefinition, 
  MCPConfig,
  MCPServiceConfig,
  RetryPolicy,
  CircuitBreakerConfig,
  SystemError 
} from '../../types';
import { AuthManager } from './auth-manager';

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: Date | null;
  halfOpenAttempts: number;
}

export class MCPClientImpl implements MCPClient {
  private config: MCPConfig;
  private httpClient: AxiosInstance;
  private authManager: AuthManager;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private rateLimiters: Map<string, { tokens: number; lastRefill: Date }> = new Map();

  constructor(config: MCPConfig) {
    this.config = config;
    this.authManager = new AuthManager();
    this.httpClient = axios.create({
      baseURL: config.gatewayUrl,
      timeout: config.defaultTimeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Client/1.0.0'
      }
    });

    // Initialize circuit breakers for each service
    Object.keys(config.services).forEach(serviceName => {
      this.circuitBreakers.set(serviceName, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        halfOpenAttempts: 0
      });

      // Initialize rate limiters
      this.rateLimiters.set(serviceName, {
        tokens: config.services[serviceName].rateLimit.requestsPerMinute,
        lastRefill: new Date()
      });
    });
  }

  async request(request: MCPRequest): Promise<MCPResponse> {
    const serviceConfig = this.config.services[request.service];
    if (!serviceConfig) {
      throw this.createError('MCP_ERROR', `Service ${request.service} not configured`);
    }

    // Check circuit breaker
    if (!this.isCircuitBreakerClosed(request.service, serviceConfig.circuitBreaker)) {
      throw this.createError('MCP_ERROR', `Circuit breaker open for service ${request.service}`);
    }

    // Check rate limit
    if (!this.checkRateLimit(request.service, serviceConfig)) {
      throw this.createError('MCP_ERROR', `Rate limit exceeded for service ${request.service}`);
    }

    const retryPolicy = request.metadata.retryPolicy || this.config.retryPolicy;
    let lastError: SystemError | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        const response = await this.executeRequest(request, serviceConfig);
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker(request.service);
        
        return {
          ...response,
          metadata: {
            ...response.metadata,
            retryCount
          }
        };
      } catch (error) {
        retryCount++;
        lastError = error instanceof Error ? 
          this.createError('MCP_ERROR', error.message) : 
          this.createError('MCP_ERROR', 'Unknown error');

        // Record failure for circuit breaker
        this.recordFailure(request.service, serviceConfig.circuitBreaker);

        if (attempt < retryPolicy.maxAttempts) {
          const delay = this.calculateRetryDelay(attempt, retryPolicy);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private async executeRequest(request: MCPRequest, serviceConfig: MCPServiceConfig): Promise<MCPResponse> {
    const startTime = Date.now();
    
    const axiosConfig: AxiosRequestConfig = {
      method: 'POST',
      url: '/mcp/request',
      data: request,
      timeout: request.metadata.timeout || serviceConfig.timeout,
      headers: this.buildAuthHeaders(request.service, serviceConfig.auth)
    };

    try {
      const response = await this.httpClient.request(axiosConfig);
      const processingTime = Date.now() - startTime;

      return {
        id: `response_${Date.now()}`,
        requestId: request.id,
        timestamp: new Date(),
        success: true,
        data: response.data,
        metadata: {
          processingTime,
          serviceEndpoint: serviceConfig.endpoint,
          retryCount: 0,
          cacheHit: false
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      if (axios.isAxiosError(error)) {
        const systemError: SystemError = {
          code: 'MCP_ERROR',
          message: error.message,
          details: {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          },
          timestamp: new Date(),
          correlationId: request.metadata.correlationId
        };

        return {
          id: `response_${Date.now()}`,
          requestId: request.id,
          timestamp: new Date(),
          success: false,
          error: systemError,
          metadata: {
            processingTime,
            serviceEndpoint: serviceConfig.endpoint,
            retryCount: 0,
            cacheHit: false
          }
        };
      }

      throw error;
    }
  }

  private buildAuthHeaders(serviceId: string, authConfig: any): Record<string, string> {
    return this.authManager.getAuthHeaders(serviceId, authConfig);
  }

  private isCircuitBreakerClosed(serviceName: string, config: CircuitBreakerConfig): boolean {
    const state = this.circuitBreakers.get(serviceName);
    if (!state) return true;

    switch (state.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (state.lastFailureTime && 
            Date.now() - state.lastFailureTime.getTime() > config.recoveryTimeout) {
          state.state = 'HALF_OPEN';
          state.halfOpenAttempts = 0;
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return state.halfOpenAttempts < config.halfOpenMaxCalls;
      default:
        return true;
    }
  }

  private recordFailure(serviceName: string, config: CircuitBreakerConfig): void {
    const state = this.circuitBreakers.get(serviceName);
    if (!state) return;

    state.failureCount++;
    state.lastFailureTime = new Date();

    if (state.state === 'HALF_OPEN') {
      state.state = 'OPEN';
      state.halfOpenAttempts = 0;
    } else if (state.failureCount >= config.failureThreshold) {
      state.state = 'OPEN';
    }
  }

  private resetCircuitBreaker(serviceName: string): void {
    const state = this.circuitBreakers.get(serviceName);
    if (!state) return;

    state.state = 'CLOSED';
    state.failureCount = 0;
    state.lastFailureTime = null;
    state.halfOpenAttempts = 0;
  }

  private checkRateLimit(serviceName: string, serviceConfig: MCPServiceConfig): boolean {
    const rateLimiter = this.rateLimiters.get(serviceName);
    if (!rateLimiter) return true;

    const now = new Date();
    const timeSinceLastRefill = now.getTime() - rateLimiter.lastRefill.getTime();
    const tokensToAdd = Math.floor(timeSinceLastRefill / (60000 / serviceConfig.rateLimit.requestsPerMinute));

    if (tokensToAdd > 0) {
      rateLimiter.tokens = Math.min(
        serviceConfig.rateLimit.burstLimit,
        rateLimiter.tokens + tokensToAdd
      );
      rateLimiter.lastRefill = now;
    }

    if (rateLimiter.tokens > 0) {
      rateLimiter.tokens--;
      return true;
    }

    return false;
  }

  private calculateRetryDelay(attempt: number, retryPolicy: RetryPolicy): number {
    let delay: number;

    if (retryPolicy.backoffStrategy === 'exponential') {
      delay = retryPolicy.initialDelay * Math.pow(2, attempt);
    } else {
      delay = retryPolicy.initialDelay * (attempt + 1);
    }

    delay = Math.min(delay, retryPolicy.maxDelay);

    if (retryPolicy.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createError(code: any, message: string): SystemError {
    return {
      code,
      message,
      timestamp: new Date()
    };
  }

  async getServiceDefinition(serviceName: string): Promise<MCPServiceDefinition> {
    const serviceConfig = this.config.services[serviceName];
    if (!serviceConfig) {
      throw this.createError('MCP_ERROR', `Service ${serviceName} not configured`);
    }

    try {
      const response = await this.httpClient.get(`/mcp/services/${serviceName}/definition`, {
        headers: this.buildAuthHeaders(serviceName, serviceConfig.auth)
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.createError('MCP_ERROR', `Failed to get service definition: ${error.message}`);
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/mcp/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Additional utility methods
  getCircuitBreakerState(serviceName: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(serviceName);
  }

  getRateLimitStatus(serviceName: string): { tokens: number; lastRefill: Date } | undefined {
    return this.rateLimiters.get(serviceName);
  }
}