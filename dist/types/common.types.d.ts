/**
 * Common types used across the agentic microservices system
 */
export interface BaseConfig {
    id: string;
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
}
export interface ServiceEndpoint {
    url: string;
    timeout: number;
    retryAttempts: number;
    circuitBreakerThreshold: number;
}
export interface AuthConfig {
    type: 'bearer' | 'api-key' | 'oauth2';
    credentials: Record<string, string>;
}
export interface LogLevel {
    level: 'debug' | 'info' | 'warn' | 'error';
}
export interface MetricsConfig {
    enabled: boolean;
    port: number;
    path: string;
}
export interface HealthCheckConfig {
    enabled: boolean;
    path: string;
    interval: number;
}
export type ErrorCode = 'AGENT_ERROR' | 'MCP_ERROR' | 'A2A_ERROR' | 'GEMINI_ERROR' | 'NETWORK_ERROR' | 'VALIDATION_ERROR' | 'TIMEOUT_ERROR' | 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'JSON_PARSE_ERROR' | 'CONVERSATION_ERROR' | 'FRAUD_DETECTION_ERROR' | 'RECOMMENDATION_ERROR' | 'CONFIGURATION_ERROR' | 'PROCESSING_ERROR';
export interface SystemError {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
    timestamp: Date;
    correlationId?: string;
}
//# sourceMappingURL=common.types.d.ts.map