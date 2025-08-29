/**
 * Model Context Protocol (MCP) type definitions
 */

import { AuthConfig, SystemError } from './common.types';

export interface MCPConfig {
  gatewayUrl: string;
  services: Record<string, MCPServiceConfig>;
  defaultTimeout: number;
  retryPolicy: RetryPolicy;
}

export interface MCPServiceConfig {
  endpoint: string;
  auth: AuthConfig;
  rateLimit: RateLimitConfig;
  timeout: number;
  circuitBreaker: CircuitBreakerConfig;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export interface MCPRequest {
  id: string;
  timestamp: Date;
  service: string;
  operation: string;
  parameters: Record<string, any>;
  metadata: MCPRequestMetadata;
}

export interface MCPRequestMetadata {
  correlationId: string;
  timeout: number;
  retryPolicy?: RetryPolicy;
  priority: 'low' | 'normal' | 'high';
  agentId: string;
}

export interface MCPResponse {
  id: string;
  requestId: string;
  timestamp: Date;
  success: boolean;
  data?: any;
  error?: SystemError;
  metadata: MCPResponseMetadata;
}

export interface MCPResponseMetadata {
  processingTime: number;
  serviceEndpoint: string;
  retryCount: number;
  cacheHit: boolean;
}

export interface MCPServiceDefinition {
  name: string;
  version: string;
  description: string;
  operations: MCPOperation[];
  schemas: Record<string, any>;
}

export interface MCPOperation {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  parameters: MCPParameter[];
  responses: MCPResponse[];
}

export interface MCPParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  schema?: Record<string, any>;
}

export interface MCPClient {
  request(request: MCPRequest): Promise<MCPResponse>;
  getServiceDefinition(serviceName: string): Promise<MCPServiceDefinition>;
  healthCheck(): Promise<boolean>;
}