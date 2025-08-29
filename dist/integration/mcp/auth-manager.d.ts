/**
 * Authentication manager for MCP services
 */
import { AuthConfig, SystemError } from '../../types';
export interface TokenRefreshResult {
    success: boolean;
    newToken?: string;
    expiresAt?: Date;
    error?: SystemError;
}
export declare class AuthManager {
    private tokenCache;
    /**
     * Get authentication headers for a service
     */
    getAuthHeaders(serviceId: string, authConfig: AuthConfig): Record<string, string>;
    /**
     * Get a valid token, refreshing if necessary
     */
    private getValidToken;
    /**
     * Refresh an OAuth2 token
     */
    refreshOAuth2Token(serviceId: string, authConfig: AuthConfig): Promise<TokenRefreshResult>;
    /**
     * Validate authentication configuration
     */
    validateAuthConfig(authConfig: AuthConfig): string[];
    /**
     * Clear cached tokens for a service
     */
    clearTokenCache(serviceId?: string): void;
    /**
     * Get cached token info for debugging
     */
    getTokenInfo(serviceId: string): {
        hasToken: boolean;
        expiresAt?: Date;
    };
}
//# sourceMappingURL=auth-manager.d.ts.map