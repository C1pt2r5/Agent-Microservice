"use strict";
/**
 * Authentication manager for MCP services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthManager = void 0;
class AuthManager {
    constructor() {
        this.tokenCache = new Map();
    }
    /**
     * Get authentication headers for a service
     */
    getAuthHeaders(serviceId, authConfig) {
        const headers = {};
        switch (authConfig.type) {
            case 'bearer':
                const token = this.getValidToken(serviceId, authConfig);
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                break;
            case 'api-key':
                if (authConfig.credentials.apiKey) {
                    headers['X-API-Key'] = authConfig.credentials.apiKey;
                }
                break;
            case 'oauth2':
                const accessToken = this.getValidToken(serviceId, authConfig);
                if (accessToken) {
                    headers['Authorization'] = `Bearer ${accessToken}`;
                }
                break;
            default:
                throw new Error(`Unsupported auth type: ${authConfig.type}`);
        }
        return headers;
    }
    /**
     * Get a valid token, refreshing if necessary
     */
    getValidToken(serviceId, authConfig) {
        const cached = this.tokenCache.get(serviceId);
        // Check if cached token is still valid
        if (cached && cached.expiresAt > new Date()) {
            return cached.token;
        }
        // For bearer tokens, use the provided token directly
        if (authConfig.type === 'bearer' && authConfig.credentials.token) {
            return authConfig.credentials.token;
        }
        // For OAuth2, use the access token directly (refresh logic would be more complex)
        if (authConfig.type === 'oauth2' && authConfig.credentials.accessToken) {
            return authConfig.credentials.accessToken;
        }
        return null;
    }
    /**
     * Refresh an OAuth2 token
     */
    async refreshOAuth2Token(serviceId, authConfig) {
        if (authConfig.type !== 'oauth2') {
            return {
                success: false,
                error: {
                    code: 'AUTHENTICATION_ERROR',
                    message: 'Token refresh only supported for OAuth2',
                    timestamp: new Date()
                }
            };
        }
        try {
            // This would typically make a request to the OAuth2 token endpoint
            // For now, we'll simulate the refresh process
            const refreshToken = authConfig.credentials.refreshToken;
            if (!refreshToken) {
                return {
                    success: false,
                    error: {
                        code: 'AUTHENTICATION_ERROR',
                        message: 'Refresh token not available',
                        timestamp: new Date()
                    }
                };
            }
            // Simulate token refresh (in real implementation, this would be an HTTP request)
            const newToken = `refreshed_${Date.now()}`;
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
            // Cache the new token
            this.tokenCache.set(serviceId, {
                token: newToken,
                expiresAt
            });
            return {
                success: true,
                newToken,
                expiresAt
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'AUTHENTICATION_ERROR',
                    message: error instanceof Error ? error.message : 'Token refresh failed',
                    timestamp: new Date()
                }
            };
        }
    }
    /**
     * Validate authentication configuration
     */
    validateAuthConfig(authConfig) {
        const errors = [];
        if (!authConfig.type) {
            errors.push('Auth type is required');
            return errors;
        }
        switch (authConfig.type) {
            case 'bearer':
                if (!authConfig.credentials.token) {
                    errors.push('Bearer token is required');
                }
                break;
            case 'api-key':
                if (!authConfig.credentials.apiKey) {
                    errors.push('API key is required');
                }
                break;
            case 'oauth2':
                if (!authConfig.credentials.accessToken) {
                    errors.push('OAuth2 access token is required');
                }
                // Refresh token is optional but recommended
                break;
            default:
                errors.push(`Unsupported auth type: ${authConfig.type}`);
        }
        return errors;
    }
    /**
     * Clear cached tokens for a service
     */
    clearTokenCache(serviceId) {
        if (serviceId) {
            this.tokenCache.delete(serviceId);
        }
        else {
            this.tokenCache.clear();
        }
    }
    /**
     * Get cached token info for debugging
     */
    getTokenInfo(serviceId) {
        const cached = this.tokenCache.get(serviceId);
        return {
            hasToken: !!cached,
            expiresAt: cached?.expiresAt
        };
    }
}
exports.AuthManager = AuthManager;
//# sourceMappingURL=auth-manager.js.map