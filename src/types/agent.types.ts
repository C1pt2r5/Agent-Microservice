/**
 * Agent-related type definitions
 */

import { BaseConfig, ServiceEndpoint, AuthConfig, SystemError } from './common.types';

export interface AgentConfig extends BaseConfig {
  type: 'chatbot' | 'fraud-detection' | 'recommendation';
  mcpEndpoint: ServiceEndpoint;
  a2aEndpoint: ServiceEndpoint;
  geminiConfig: GeminiConfig;
  capabilities: AgentCapability[];
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  endpoint: string;
  maxTokens: number;
  temperature: number;
  rateLimitPerMinute: number;
}

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
}

export interface AgentState {
  id: string;
  status: 'initializing' | 'running' | 'paused' | 'error' | 'stopped';
  lastHeartbeat: Date;
  metrics: AgentMetrics;
  errors: SystemError[];
}

export interface AgentMetrics {
  requestsProcessed: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface AgentRequest {
  id: string;
  timestamp: Date;
  correlationId: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  id: string;
  requestId: string;
  timestamp: Date;
  success: boolean;
  payload?: Record<string, any>;
  error?: SystemError;
  processingTime: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected state: AgentState;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      id: config.id,
      status: 'initializing',
      lastHeartbeat: new Date(),
      metrics: {
        requestsProcessed: 0,
        averageResponseTime: 0,
        errorRate: 0,
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      },
      errors: []
    };
  }

  abstract initialize(): Promise<void>;
  abstract processRequest(request: AgentRequest): Promise<AgentResponse>;
  abstract shutdown(): Promise<void>;
  abstract isAgentHealthy(): boolean;
  
  getState(): AgentState {
    return { ...this.state };
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }
}