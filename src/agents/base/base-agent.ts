/**
 * Enhanced base agent implementation with comprehensive functionality
 */

import { EventEmitter } from 'events';
import { BaseAgent, AgentConfig, AgentRequest, AgentResponse, SystemError } from '../../types';
import { MCPClientImpl } from '../../integration/mcp/mcp-client';
import { A2AClientImpl } from '../../integration/a2a/a2a-client';
import { EnhancedGeminiClient } from '../../integration/gemini/enhanced-gemini-client';

export interface AgentDependencies {
  mcpClient?: MCPClientImpl;
  a2aClient?: A2AClientImpl;
  geminiClient?: EnhancedGeminiClient;
}

export class ConcreteBaseAgent extends BaseAgent {
  protected eventEmitter: EventEmitter;
  protected mcpClient?: MCPClientImpl;
  protected a2aClient?: A2AClientImpl;
  protected geminiClient?: EnhancedGeminiClient;
  protected isInitialized: boolean = false;
  protected heartbeatInterval?: NodeJS.Timeout;
  protected metricsInterval?: NodeJS.Timeout;

  constructor(config: AgentConfig, dependencies?: AgentDependencies) {
    super(config);
    this.eventEmitter = new EventEmitter();
    
    // Inject dependencies
    this.mcpClient = dependencies?.mcpClient;
    this.a2aClient = dependencies?.a2aClient;
    this.geminiClient = dependencies?.geminiClient;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Agent is already initialized');
    }

    try {
      this.state.status = 'initializing';

      // Initialize MCP client if not provided and dependencies weren't explicitly set to undefined
      if (this.mcpClient === undefined && this.config.mcpEndpoint) {
        const mcpConfig = {
          gatewayUrl: this.config.mcpEndpoint.url,
          defaultTimeout: this.config.mcpEndpoint.timeout,
          retryPolicy: {
            maxAttempts: this.config.mcpEndpoint.retryAttempts,
            backoffStrategy: 'exponential' as const,
            initialDelay: 1000,
            maxDelay: 10000,
            jitter: true
          },
          services: {} // Will be populated based on agent needs
        };
        this.mcpClient = new MCPClientImpl(mcpConfig);
      }

      // Initialize A2A client if not provided and dependencies weren't explicitly set to undefined
      if (this.a2aClient === undefined && this.config.a2aEndpoint) {
        const a2aConfig = {
          hubUrl: this.config.a2aEndpoint.url,
          agentId: this.config.id,
          subscriptions: [], // Will be set up by specific agents
          messageRetention: 86400000, // 24 hours
          maxRetries: this.config.a2aEndpoint.retryAttempts
        };
        this.a2aClient = new A2AClientImpl(a2aConfig);
        // Only connect if not in test environment
        if (process.env.NODE_ENV !== 'test') {
          await this.a2aClient.connect();
        }
      } else if (this.a2aClient && this.config.a2aEndpoint) {
        // If A2A client was provided, connect it (only in non-test environments)
        if (process.env.NODE_ENV !== 'test') {
          await this.a2aClient.connect();
        }
      }

      // Initialize Gemini client if not provided and dependencies weren't explicitly set to undefined
      if (this.geminiClient === undefined && this.config.geminiConfig) {
        this.geminiClient = new EnhancedGeminiClient(this.config.geminiConfig);
      }

      // Set up event listeners
      this.setupEventListeners();

      // Start background tasks (skip in test environment)
      if (process.env.DISABLE_BACKGROUND_TASKS !== 'true') {
        this.startHeartbeat();
        this.startMetricsCollection();
      }

      // Register with A2A hub if available
      if (this.a2aClient) {
        await this.registerWithA2AHub();
      }

      this.state.status = 'running';
      this.state.lastHeartbeat = new Date();
      this.isInitialized = true;

      this.eventEmitter.emit('initialized', { agentId: this.config.id });
      console.log(`Agent ${this.config.name} initialized successfully`);

    } catch (error) {
      this.state.status = 'error';
      const systemError: SystemError = {
        code: 'AGENT_ERROR',
        message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      this.state.errors.push(systemError);
      this.eventEmitter.emit('initializationError', systemError);
      throw error;
    }
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateRequest(request);

      // Update metrics
      this.state.metrics.requestsProcessed++;
      
      // Emit request received event
      this.eventEmitter.emit('requestReceived', { request });

      // Process request (to be overridden by specific agents)
      const response = await this.handleRequest(request);

      // Update metrics
      const processingTime = Date.now() - startTime;
      response.processingTime = processingTime;
      this.updateResponseTimeMetrics(processingTime);

      // Emit response sent event
      this.eventEmitter.emit('responseSent', { request, response });

      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const systemError: SystemError = {
        code: 'AGENT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        correlationId: request.correlationId
      };

      this.state.errors.push(systemError);
      this.updateErrorMetrics();

      const errorResponse: AgentResponse = {
        id: `response_${Date.now()}`,
        requestId: request.id,
        timestamp: new Date(),
        success: false,
        error: systemError,
        processingTime
      };

      this.eventEmitter.emit('requestError', { request, error: systemError });
      return errorResponse;
    }
  }

  protected async handleRequest(request: AgentRequest): Promise<AgentResponse> {
    // Base implementation - to be overridden by specific agents
    return {
      id: `response_${Date.now()}`,
      requestId: request.id,
      timestamp: new Date(),
      success: true,
      payload: { 
        message: 'Base agent response',
        agentType: this.config.type,
        capabilities: this.config.capabilities.map(cap => cap.name)
      },
      processingTime: 0 // Will be set by processRequest
    };
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.state.status = 'stopped';

      // Stop background tasks
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }

      // Disconnect from A2A hub
      if (this.a2aClient) {
        await this.a2aClient.disconnect();
      }

      // Perform agent-specific cleanup
      await this.performCleanup();

      this.state.status = 'stopped';
      this.isInitialized = false;

      this.eventEmitter.emit('shutdown', { agentId: this.config.id });
      console.log(`Agent ${this.config.name} shutdown complete`);

    } catch (error) {
      const systemError: SystemError = {
        code: 'AGENT_ERROR',
        message: `Shutdown failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      this.state.errors.push(systemError);
      this.eventEmitter.emit('shutdownError', systemError);
      throw error;
    }
  }

  protected async performCleanup(): Promise<void> {
    // Override in specific agents for custom cleanup
  }

  protected validateRequest(request: AgentRequest): void {
    if (!request.id) {
      throw new Error('Request ID is required');
    }
    if (!request.timestamp) {
      throw new Error('Request timestamp is required');
    }
    if (!request.correlationId) {
      throw new Error('Correlation ID is required');
    }
    if (!request.payload) {
      throw new Error('Request payload is required');
    }
  }

  protected setupEventListeners(): void {
    // Set up A2A client event listeners
    if (this.a2aClient) {
      this.a2aClient.on('messageProcessed', ({ message, response }) => {
        this.eventEmitter.emit('a2aMessageProcessed', { message, response });
      });

      this.a2aClient.on('messageError', ({ message, error }) => {
        this.eventEmitter.emit('a2aMessageError', { message, error });
      });

      this.a2aClient.on('connected', () => {
        this.eventEmitter.emit('a2aConnected');
      });

      this.a2aClient.on('disconnected', () => {
        this.eventEmitter.emit('a2aDisconnected');
      });
    }
  }

  protected async registerWithA2AHub(): Promise<void> {
    if (!this.a2aClient) {
      return;
    }

    const registration = {
      agentId: this.config.id,
      agentType: this.config.type,
      capabilities: this.config.capabilities.map(cap => cap.name),
      subscriptions: [], // Will be set by specific agents
      endpoint: `http://${this.config.id}:8080`, // Default endpoint
      heartbeatInterval: 30000
    };

    await this.a2aClient.registerAgent(registration);
  }

  protected startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.updateHeartbeat();
      this.eventEmitter.emit('heartbeat', { 
        agentId: this.config.id, 
        timestamp: this.state.lastHeartbeat 
      });
    }, 30000); // Every 30 seconds
  }

  protected startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateSystemMetrics();
      this.eventEmitter.emit('metricsUpdated', { 
        agentId: this.config.id, 
        metrics: this.state.metrics 
      });
    }, 60000); // Every minute
  }

  protected updateHeartbeat(): void {
    this.state.lastHeartbeat = new Date();
  }

  protected updateResponseTimeMetrics(processingTime: number): void {
    const metrics = this.state.metrics;
    const totalTime = metrics.averageResponseTime * (metrics.requestsProcessed - 1) + processingTime;
    metrics.averageResponseTime = totalTime / metrics.requestsProcessed;
  }

  protected updateErrorMetrics(): void {
    const metrics = this.state.metrics;
    metrics.errorRate = this.state.errors.length / Math.max(metrics.requestsProcessed, 1);
  }

  protected updateSystemMetrics(): void {
    const metrics = this.state.metrics;
    
    // Update uptime
    metrics.uptime = process.uptime();
    
    // Update memory usage (in MB)
    const memUsage = process.memoryUsage();
    metrics.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // CPU usage would require additional monitoring (simplified here)
    metrics.cpuUsage = Math.random() * 100; // Placeholder
  }

  protected logError(error: SystemError): void {
    console.error(`Agent ${this.config.name} error:`, error);
    this.state.errors.push(error);
    this.eventEmitter.emit('error', error);
  }

  // Public methods for external interaction
  
  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  emit(event: string, ...args: any[]): void {
    this.eventEmitter.emit(event, ...args);
  }

  async sendA2AMessage(topic: string, messageType: string, payload: any, targetAgent?: string): Promise<void> {
    if (!this.a2aClient) {
      throw new Error('A2A client not available');
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      sourceAgent: this.config.id,
      targetAgent,
      topic,
      messageType,
      priority: 'normal' as const,
      payload,
      metadata: {
        correlationId: `corr_${Date.now()}`,
        ttl: 300000, // 5 minutes
        retryCount: 0,
        deliveryAttempts: 0
      }
    };

    await this.a2aClient.publish(message);
  }

  async queryMCP(service: string, operation: string, parameters: any): Promise<any> {
    if (!this.mcpClient) {
      throw new Error('MCP client not available');
    }

    const request = {
      id: `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      service,
      operation,
      parameters,
      metadata: {
        correlationId: `corr_${Date.now()}`,
        timeout: 30000,
        priority: 'normal' as const,
        agentId: this.config.id
      }
    };

    const response = await this.mcpClient.request(request);
    
    if (!response.success) {
      throw new Error(`MCP request failed: ${response.error?.message}`);
    }

    return response.data;
  }

  getHealthStatus(): {
    status: string;
    uptime: number;
    metrics: any;
    lastError?: SystemError;
  } {
    return {
      status: this.state.status,
      uptime: this.state.metrics.uptime,
      metrics: this.state.metrics,
      lastError: this.state.errors[this.state.errors.length - 1]
    };
  }

  isAgentHealthy(): boolean {
    return this.state.status === 'running' && 
           this.state.metrics.errorRate < 0.1 && // Less than 10% error rate
           this.isInitialized;
  }
}