"use strict";
/**
 * Configuration management for MCP Gateway
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayConfigManager = void 0;
class GatewayConfigManager {
    /**
     * Load gateway configuration from environment variables
     */
    static loadFromEnvironment() {
        const config = {
            gatewayUrl: process.env.MCP_GATEWAY_URL || 'http://localhost:8080',
            defaultTimeout: parseInt(process.env.MCP_DEFAULT_TIMEOUT || '30000'),
            retryPolicy: {
                maxAttempts: parseInt(process.env.MCP_RETRY_MAX_ATTEMPTS || '3'),
                backoffStrategy: process.env.MCP_RETRY_STRATEGY || 'exponential',
                initialDelay: parseInt(process.env.MCP_RETRY_INITIAL_DELAY || '1000'),
                maxDelay: parseInt(process.env.MCP_RETRY_MAX_DELAY || '30000'),
                jitter: process.env.MCP_RETRY_JITTER === 'true'
            },
            services: {}
        };
        // Load service configurations
        const serviceNames = (process.env.MCP_SERVICES || '').split(',').filter(name => name.trim());
        serviceNames.forEach(serviceName => {
            const serviceConfig = this.loadServiceConfig(serviceName.trim());
            if (serviceConfig) {
                config.services[serviceName.trim()] = serviceConfig;
            }
        });
        return config;
    }
    /**
     * Load configuration for a specific service
     */
    static loadServiceConfig(serviceName) {
        const prefix = `MCP_SERVICE_${serviceName.toUpperCase().replace('-', '_')}`;
        const endpoint = process.env[`${prefix}_ENDPOINT`];
        if (!endpoint) {
            console.warn(`No endpoint configured for service ${serviceName}`);
            return null;
        }
        const authType = process.env[`${prefix}_AUTH_TYPE`];
        if (!authType) {
            console.warn(`No auth type configured for service ${serviceName}`);
            return null;
        }
        const authConfig = {
            type: authType,
            credentials: this.loadAuthCredentials(prefix, authType)
        };
        return {
            endpoint,
            auth: authConfig,
            rateLimit: {
                requestsPerMinute: parseInt(process.env[`${prefix}_RATE_LIMIT_RPM`] || '100'),
                burstLimit: parseInt(process.env[`${prefix}_RATE_LIMIT_BURST`] || '20')
            },
            timeout: parseInt(process.env[`${prefix}_TIMEOUT`] || '30000'),
            circuitBreaker: {
                failureThreshold: parseInt(process.env[`${prefix}_CB_FAILURE_THRESHOLD`] || '5'),
                recoveryTimeout: parseInt(process.env[`${prefix}_CB_RECOVERY_TIMEOUT`] || '30000'),
                halfOpenMaxCalls: parseInt(process.env[`${prefix}_CB_HALF_OPEN_MAX_CALLS`] || '3')
            }
        };
    }
    /**
     * Load authentication credentials based on auth type
     */
    static loadAuthCredentials(prefix, authType) {
        const credentials = {};
        switch (authType) {
            case 'bearer':
                const token = process.env[`${prefix}_TOKEN`];
                if (token)
                    credentials.token = token;
                break;
            case 'api-key':
                const apiKey = process.env[`${prefix}_API_KEY`];
                if (apiKey)
                    credentials.apiKey = apiKey;
                break;
            case 'oauth2':
                const accessToken = process.env[`${prefix}_ACCESS_TOKEN`];
                const refreshToken = process.env[`${prefix}_REFRESH_TOKEN`];
                if (accessToken)
                    credentials.accessToken = accessToken;
                if (refreshToken)
                    credentials.refreshToken = refreshToken;
                break;
        }
        return credentials;
    }
    /**
     * Create a development configuration with mock services
     */
    static createDevelopmentConfig() {
        return {
            gatewayUrl: 'http://localhost:8080',
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
                    endpoint: 'http://localhost:8081',
                    auth: {
                        type: 'bearer',
                        credentials: { token: 'dev-user-token' }
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
                    endpoint: 'http://localhost:8082',
                    auth: {
                        type: 'api-key',
                        credentials: { apiKey: 'dev-transaction-key' }
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
                    endpoint: 'http://localhost:8083',
                    auth: {
                        type: 'bearer',
                        credentials: { token: 'dev-product-token' }
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
    }
    /**
     * Create a production configuration template
     */
    static createProductionConfig(services) {
        const config = {
            gatewayUrl: process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080',
            defaultTimeout: 30000,
            retryPolicy: {
                maxAttempts: 5,
                backoffStrategy: 'exponential',
                initialDelay: 500,
                maxDelay: 30000,
                jitter: true
            },
            services: {}
        };
        services.forEach(service => {
            config.services[service.name] = {
                endpoint: service.endpoint,
                auth: {
                    type: service.authType,
                    credentials: service.credentials
                },
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
        return config;
    }
    /**
     * Validate gateway configuration
     */
    static validateConfig(config) {
        const errors = [];
        if (!config.gatewayUrl) {
            errors.push('Gateway URL is required');
        }
        if (!config.defaultTimeout || config.defaultTimeout <= 0) {
            errors.push('Default timeout must be positive');
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
            if (!['linear', 'exponential'].includes(config.retryPolicy.backoffStrategy)) {
                errors.push('Backoff strategy must be linear or exponential');
            }
        }
        if (!config.services || Object.keys(config.services).length === 0) {
            errors.push('At least one service must be configured');
        }
        else {
            Object.entries(config.services).forEach(([serviceName, serviceConfig]) => {
                const serviceErrors = this.validateServiceConfig(serviceName, serviceConfig);
                errors.push(...serviceErrors);
            });
        }
        return errors;
    }
    /**
     * Validate individual service configuration
     */
    static validateServiceConfig(serviceName, config) {
        const errors = [];
        if (!config.endpoint) {
            errors.push(`Service ${serviceName}: endpoint is required`);
        }
        else {
            try {
                new URL(config.endpoint);
            }
            catch {
                errors.push(`Service ${serviceName}: invalid endpoint URL`);
            }
        }
        if (!config.auth) {
            errors.push(`Service ${serviceName}: auth configuration is required`);
        }
        else {
            if (!['bearer', 'api-key', 'oauth2'].includes(config.auth.type)) {
                errors.push(`Service ${serviceName}: invalid auth type`);
            }
            switch (config.auth.type) {
                case 'bearer':
                    if (!config.auth.credentials.token) {
                        errors.push(`Service ${serviceName}: bearer token is required`);
                    }
                    break;
                case 'api-key':
                    if (!config.auth.credentials.apiKey) {
                        errors.push(`Service ${serviceName}: API key is required`);
                    }
                    break;
                case 'oauth2':
                    if (!config.auth.credentials.accessToken) {
                        errors.push(`Service ${serviceName}: OAuth2 access token is required`);
                    }
                    break;
            }
        }
        if (!config.rateLimit) {
            errors.push(`Service ${serviceName}: rate limit configuration is required`);
        }
        else {
            if (config.rateLimit.requestsPerMinute <= 0) {
                errors.push(`Service ${serviceName}: requests per minute must be positive`);
            }
            if (config.rateLimit.burstLimit <= 0) {
                errors.push(`Service ${serviceName}: burst limit must be positive`);
            }
        }
        if (!config.circuitBreaker) {
            errors.push(`Service ${serviceName}: circuit breaker configuration is required`);
        }
        else {
            if (config.circuitBreaker.failureThreshold <= 0) {
                errors.push(`Service ${serviceName}: failure threshold must be positive`);
            }
            if (config.circuitBreaker.recoveryTimeout <= 0) {
                errors.push(`Service ${serviceName}: recovery timeout must be positive`);
            }
            if (config.circuitBreaker.halfOpenMaxCalls <= 0) {
                errors.push(`Service ${serviceName}: half open max calls must be positive`);
            }
        }
        if (!config.timeout || config.timeout <= 0) {
            errors.push(`Service ${serviceName}: timeout must be positive`);
        }
        return errors;
    }
}
exports.GatewayConfigManager = GatewayConfigManager;
//# sourceMappingURL=gateway-config.js.map