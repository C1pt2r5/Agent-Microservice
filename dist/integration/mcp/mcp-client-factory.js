"use strict";
/**
 * Factory for creating MCP clients with different configurations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClientFactory = void 0;
const mcp_client_1 = require("./mcp-client");
class MCPClientFactory {
    /**
     * Create an MCP client with the provided configuration
     */
    static createClient(config) {
        return new mcp_client_1.MCPClientImpl(config);
    }
    /**
     * Create an MCP client with default configuration for development
     */
    static createDevelopmentClient(gatewayUrl = 'http://localhost:8080') {
        const config = {
            gatewayUrl,
            defaultTimeout: 30000,
            retryPolicy: {
                maxAttempts: 3,
                backoffStrategy: 'exponential',
                initialDelay: 1000,
                maxDelay: 10000,
                jitter: true
            },
            services: {
                'user-service': {
                    endpoint: 'http://user-service:8080',
                    auth: {
                        type: 'bearer',
                        credentials: { token: process.env.USER_SERVICE_TOKEN || 'dev-token' }
                    },
                    rateLimit: {
                        requestsPerMinute: 100,
                        burstLimit: 20
                    },
                    timeout: 30000,
                    circuitBreaker: {
                        failureThreshold: 5,
                        recoveryTimeout: 30000,
                        halfOpenMaxCalls: 3
                    }
                },
                'transaction-service': {
                    endpoint: 'http://transaction-service:8080',
                    auth: {
                        type: 'api-key',
                        credentials: { apiKey: process.env.TRANSACTION_SERVICE_API_KEY || 'dev-api-key' }
                    },
                    rateLimit: {
                        requestsPerMinute: 200,
                        burstLimit: 50
                    },
                    timeout: 15000,
                    circuitBreaker: {
                        failureThreshold: 3,
                        recoveryTimeout: 20000,
                        halfOpenMaxCalls: 2
                    }
                },
                'product-service': {
                    endpoint: 'http://product-service:8080',
                    auth: {
                        type: 'bearer',
                        credentials: { token: process.env.PRODUCT_SERVICE_TOKEN || 'dev-token' }
                    },
                    rateLimit: {
                        requestsPerMinute: 150,
                        burstLimit: 30
                    },
                    timeout: 25000,
                    circuitBreaker: {
                        failureThreshold: 4,
                        recoveryTimeout: 25000,
                        halfOpenMaxCalls: 3
                    }
                }
            }
        };
        return new mcp_client_1.MCPClientImpl(config);
    }
    /**
     * Create an MCP client configured for production use
     */
    static createProductionClient(gatewayUrl, services) {
        const serviceConfigs = {};
        Object.entries(services).forEach(([serviceName, serviceInfo]) => {
            serviceConfigs[serviceName] = {
                endpoint: serviceInfo.endpoint,
                auth: serviceInfo.auth,
                rateLimit: {
                    requestsPerMinute: 300,
                    burstLimit: 100
                },
                timeout: 30000,
                circuitBreaker: {
                    failureThreshold: 5,
                    recoveryTimeout: 60000,
                    halfOpenMaxCalls: 5
                }
            };
        });
        const config = {
            gatewayUrl,
            defaultTimeout: 30000,
            retryPolicy: {
                maxAttempts: 5,
                backoffStrategy: 'exponential',
                initialDelay: 500,
                maxDelay: 30000,
                jitter: true
            },
            services: serviceConfigs
        };
        return new mcp_client_1.MCPClientImpl(config);
    }
    /**
     * Create an MCP client for testing with mock services
     */
    static createTestClient(mockGatewayUrl = 'http://localhost:9999') {
        const config = {
            gatewayUrl: mockGatewayUrl,
            defaultTimeout: 5000,
            retryPolicy: {
                maxAttempts: 1,
                backoffStrategy: 'linear',
                initialDelay: 100,
                maxDelay: 1000,
                jitter: false
            },
            services: {
                'mock-service': {
                    endpoint: 'http://mock-service:8080',
                    auth: {
                        type: 'bearer',
                        credentials: { token: 'test-token' }
                    },
                    rateLimit: {
                        requestsPerMinute: 1000,
                        burstLimit: 100
                    },
                    timeout: 5000,
                    circuitBreaker: {
                        failureThreshold: 10,
                        recoveryTimeout: 1000,
                        halfOpenMaxCalls: 1
                    }
                }
            }
        };
        return new mcp_client_1.MCPClientImpl(config);
    }
    /**
     * Validate MCP configuration
     */
    static validateConfig(config) {
        const errors = [];
        if (!config.gatewayUrl) {
            errors.push('Gateway URL is required');
        }
        if (!config.defaultTimeout || config.defaultTimeout <= 0) {
            errors.push('Default timeout must be a positive number');
        }
        if (!config.retryPolicy) {
            errors.push('Retry policy is required');
        }
        else {
            if (config.retryPolicy.maxAttempts < 0) {
                errors.push('Max retry attempts must be non-negative');
            }
            if (config.retryPolicy.initialDelay <= 0) {
                errors.push('Initial delay must be positive');
            }
            if (config.retryPolicy.maxDelay <= 0) {
                errors.push('Max delay must be positive');
            }
        }
        if (!config.services || Object.keys(config.services).length === 0) {
            errors.push('At least one service must be configured');
        }
        else {
            Object.entries(config.services).forEach(([serviceName, serviceConfig]) => {
                if (!serviceConfig.endpoint) {
                    errors.push(`Service ${serviceName}: endpoint is required`);
                }
                if (!serviceConfig.auth) {
                    errors.push(`Service ${serviceName}: auth configuration is required`);
                }
                if (!serviceConfig.rateLimit) {
                    errors.push(`Service ${serviceName}: rate limit configuration is required`);
                }
                if (!serviceConfig.circuitBreaker) {
                    errors.push(`Service ${serviceName}: circuit breaker configuration is required`);
                }
            });
        }
        return errors;
    }
}
exports.MCPClientFactory = MCPClientFactory;
//# sourceMappingURL=mcp-client-factory.js.map