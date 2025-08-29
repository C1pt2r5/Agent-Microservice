/**
 * Main entry point for the agentic microservices system
 */

import { config } from 'dotenv';
import { AgentConfig } from './types';

// Load environment variables
config();

// Export types
export * from './types';

// Export agents
export * from './agents';

// Export integration
export * from './integration';

// Export infrastructure with specific naming to avoid conflicts
export * from './infrastructure/adk';
export * from './infrastructure/config';

// Export monitoring with namespace to avoid conflicts
export * as Monitoring from './infrastructure/monitoring';

// Main application bootstrap
export async function bootstrap(agentConfig: AgentConfig): Promise<void> {
  console.log(`Starting ${agentConfig.name} agent...`);
  console.log(`Environment: ${agentConfig.environment}`);
  console.log(`Agent Type: ${agentConfig.type}`);
  
  // Agent initialization will be implemented in subsequent tasks
  console.log('Agent bootstrap complete');
}

// Export default configuration template
export const defaultConfig: AgentConfig = {
  id: '',
  name: '',
  type: 'chatbot',
  version: '1.0.0',
  environment: 'development',
  mcpEndpoint: {
    url: 'http://localhost:8080',
    timeout: 30000,
    retryAttempts: 3,
    circuitBreakerThreshold: 5
  },
  a2aEndpoint: {
    url: 'http://localhost:8081',
    timeout: 15000,
    retryAttempts: 3,
    circuitBreakerThreshold: 5
  },
  geminiConfig: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    maxTokens: 2048,
    temperature: 0.7,
    rateLimitPerMinute: 60
  },
  capabilities: []
};