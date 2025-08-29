/**
 * Unit tests for AuthManager
 */

import { AuthManager } from '../auth-manager';
import { AuthConfig } from '../../../types';

describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('getAuthHeaders', () => {
    it('should generate bearer token headers', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        credentials: { token: 'test-bearer-token' }
      };

      const headers = authManager.getAuthHeaders('test-service', authConfig);

      expect(headers).toEqual({
        'Authorization': 'Bearer test-bearer-token'
      });
    });

    it('should generate API key headers', () => {
      const authConfig: AuthConfig = {
        type: 'api-key',
        credentials: { apiKey: 'test-api-key' }
      };

      const headers = authManager.getAuthHeaders('test-service', authConfig);

      expect(headers).toEqual({
        'X-API-Key': 'test-api-key'
      });
    });

    it('should generate OAuth2 headers', () => {
      const authConfig: AuthConfig = {
        type: 'oauth2',
        credentials: { accessToken: 'test-access-token' }
      };

      const headers = authManager.getAuthHeaders('test-service', authConfig);

      expect(headers).toEqual({
        'Authorization': 'Bearer test-access-token'
      });
    });

    it('should throw error for unsupported auth type', () => {
      const authConfig: AuthConfig = {
        type: 'unsupported' as any,
        credentials: {}
      };

      expect(() => {
        authManager.getAuthHeaders('test-service', authConfig);
      }).toThrow('Unsupported auth type: unsupported');
    });
  });

  describe('validateAuthConfig', () => {
    it('should validate bearer token config', () => {
      const validConfig: AuthConfig = {
        type: 'bearer',
        credentials: { token: 'test-token' }
      };

      const errors = authManager.validateAuthConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing bearer token', () => {
      const invalidConfig: AuthConfig = {
        type: 'bearer',
        credentials: {}
      };

      const errors = authManager.validateAuthConfig(invalidConfig);
      expect(errors).toContain('Bearer token is required');
    });

    it('should validate API key config', () => {
      const validConfig: AuthConfig = {
        type: 'api-key',
        credentials: { apiKey: 'test-key' }
      };

      const errors = authManager.validateAuthConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing API key', () => {
      const invalidConfig: AuthConfig = {
        type: 'api-key',
        credentials: {}
      };

      const errors = authManager.validateAuthConfig(invalidConfig);
      expect(errors).toContain('API key is required');
    });

    it('should validate OAuth2 config', () => {
      const validConfig: AuthConfig = {
        type: 'oauth2',
        credentials: { accessToken: 'test-access-token' }
      };

      const errors = authManager.validateAuthConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing OAuth2 access token', () => {
      const invalidConfig: AuthConfig = {
        type: 'oauth2',
        credentials: {}
      };

      const errors = authManager.validateAuthConfig(invalidConfig);
      expect(errors).toContain('OAuth2 access token is required');
    });

    it('should return error for missing auth type', () => {
      const invalidConfig: AuthConfig = {
        type: '' as any,
        credentials: {}
      };

      const errors = authManager.validateAuthConfig(invalidConfig);
      expect(errors).toContain('Auth type is required');
    });
  });

  describe('refreshOAuth2Token', () => {
    it('should successfully refresh OAuth2 token', async () => {
      const authConfig: AuthConfig = {
        type: 'oauth2',
        credentials: { 
          accessToken: 'old-token',
          refreshToken: 'refresh-token'
        }
      };

      const result = await authManager.refreshOAuth2Token('test-service', authConfig);

      expect(result.success).toBe(true);
      expect(result.newToken).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should fail to refresh token without refresh token', async () => {
      const authConfig: AuthConfig = {
        type: 'oauth2',
        credentials: { accessToken: 'old-token' }
      };

      const result = await authManager.refreshOAuth2Token('test-service', authConfig);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Refresh token not available');
    });

    it('should fail to refresh non-OAuth2 token', async () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        credentials: { token: 'bearer-token' }
      };

      const result = await authManager.refreshOAuth2Token('test-service', authConfig);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Token refresh only supported for OAuth2');
    });
  });

  describe('token caching', () => {
    it('should cache and retrieve token info', () => {
      // Initially no token
      let tokenInfo = authManager.getTokenInfo('test-service');
      expect(tokenInfo.hasToken).toBe(false);

      // Simulate token refresh which caches the token
      const authConfig: AuthConfig = {
        type: 'oauth2',
        credentials: { 
          accessToken: 'old-token',
          refreshToken: 'refresh-token'
        }
      };

      authManager.refreshOAuth2Token('test-service', authConfig);

      // Should now have cached token info
      tokenInfo = authManager.getTokenInfo('test-service');
      expect(tokenInfo.hasToken).toBe(true);
      expect(tokenInfo.expiresAt).toBeDefined();
    });

    it('should clear token cache', () => {
      // First refresh a token to cache it
      const authConfig: AuthConfig = {
        type: 'oauth2',
        credentials: { 
          accessToken: 'old-token',
          refreshToken: 'refresh-token'
        }
      };

      authManager.refreshOAuth2Token('test-service', authConfig);

      // Verify token is cached
      let tokenInfo = authManager.getTokenInfo('test-service');
      expect(tokenInfo.hasToken).toBe(true);

      // Clear cache for specific service
      authManager.clearTokenCache('test-service');

      // Verify token is no longer cached
      tokenInfo = authManager.getTokenInfo('test-service');
      expect(tokenInfo.hasToken).toBe(false);
    });

    it('should clear all token caches', () => {
      // Refresh tokens for multiple services
      const authConfig: AuthConfig = {
        type: 'oauth2',
        credentials: { 
          accessToken: 'old-token',
          refreshToken: 'refresh-token'
        }
      };

      authManager.refreshOAuth2Token('service1', authConfig);
      authManager.refreshOAuth2Token('service2', authConfig);

      // Verify both tokens are cached
      expect(authManager.getTokenInfo('service1').hasToken).toBe(true);
      expect(authManager.getTokenInfo('service2').hasToken).toBe(true);

      // Clear all caches
      authManager.clearTokenCache();

      // Verify all tokens are cleared
      expect(authManager.getTokenInfo('service1').hasToken).toBe(false);
      expect(authManager.getTokenInfo('service2').hasToken).toBe(false);
    });
  });
});