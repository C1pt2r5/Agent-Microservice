#!/usr/bin/env node

/**
 * Interactive Agentic Microservices Demo
 * Real-time demonstration of AI agent capabilities
 */

const readline = require('readline');
const { ConcreteBaseAgent } = require('./dist/agents/base/base-agent');
const { MCPClientImpl } = require('./dist/integration/mcp/mcp-client');
const { A2AClientImpl } = require('./dist/integration/a2a/a2a-client');
const { EnhancedGeminiClient } = require('./dist/integration/gemini/enhanced-gemini-client');

class InteractiveDemo {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.agents = new Map();
    this.sessions = new Map();
    this.isRunning = false;
  }

  async initialize() {
    console.log('\n🤖 Initializing Agentic Microservices System...\n');

    try {
      // Create mock services for demonstration
      const mockMCPClient = this.createMockMCPClient();
      const mockA2AClient = this.createMockA2AClient();
      const mockGeminiClient = this.createMockGeminiClient();

      // Create agent configurations
      const agentsConfig = [
        {
          id: 'chatbot-demo',
          name: 'Customer Support Agent',
          type: 'chatbot',
          environment: 'demo',
          mcpEndpoint: { url: 'http://localhost:8080', timeout: 30000, retryAttempts: 3, circuitBreakerThreshold: 5 },
          a2aEndpoint: { url: 'http://localhost:8081', timeout: 15000, retryAttempts: 3, circuitBreakerThreshold: 5 },
          geminiConfig: {
            apiKey: 'demo-key',
            model: 'gemini-pro',
            endpoint: 'https://demo-endpoint',
            maxTokens: 2048,
            temperature: 0.7,
            rateLimitPerMinute: 60
          },
          capabilities: [
            { name: 'conversation', description: 'Handle customer conversations', inputSchema: { type: 'string' }, outputSchema: { type: 'string' } }
          ]
        },
        {
          id: 'fraud-detection-demo',
          name: 'Security Agent',
          type: 'fraud-detection',
          environment: 'demo',
          mcpEndpoint: { url: 'http://localhost:8080', timeout: 30000, retryAttempts: 3, circuitBreakerThreshold: 5 },
          a2aEndpoint: { url: 'http://localhost:8081', timeout: 15000, retryAttempts: 3, circuitBreakerThreshold: 5 },
          geminiConfig: {
            apiKey: 'demo-key',
            model: 'gemini-pro',
            endpoint: 'https://demo-endpoint',
            maxTokens: 2048,
            temperature: 0.7,
            rateLimitPerMinute: 60
          },
          capabilities: [
            { name: 'risk-assessment', description: 'Assess transaction risk', inputSchema: { type: 'object' }, outputSchema: { type: 'object' } }
          ]
        },
        {
          id: 'recommendation-demo',
          name: 'Recommendation Agent',
          type: 'recommendation',
          environment: 'demo',
          mcpEndpoint: { url: 'http://localhost:8080', timeout: 30000, retryAttempts: 3, circuitBreakerThreshold: 5 },
          a2aEndpoint: { url: 'http://localhost:8081', timeout: 15000, retryAttempts: 3, circuitBreakerThreshold: 5 },
          geminiConfig: {
            apiKey: 'demo-key',
            model: 'gemini-pro',
            endpoint: 'https://demo-endpoint',
            maxTokens: 2048,
            temperature: 0.7,
            rateLimitPerMinute: 60
          },
          capabilities: [
            { name: 'product-recommendation', description: 'Generate recommendations', inputSchema: { type: 'object' }, outputSchema: { type: 'array' } }
          ]
        }
      ];

      // Initialize agents
      for (const config of agentsConfig) {
        console.log(`🚀 Initializing ${config.name}...`);

        const agent = new ConcreteBaseAgent(config, {
          mcpClient: mockMCPClient,
          a2aClient: mockA2AClient,
          geminiClient: mockGeminiClient
        });

        await agent.initialize();
        this.agents.set(config.id, agent);

        console.log(`✅ ${config.name} ready!\n`);
      }

      console.log('🎉 All agents initialized successfully!\n');
      console.log('=' .repeat(50));
      console.log('🎯 INTERACTIVE DEMO STARTED');
      console.log('=' .repeat(50));
      console.log('\nAvailable commands:');
      console.log('• chat - Talk to the chatbot');
      console.log('• fraud - Test fraud detection');
      console.log('• recommend - Get product recommendations');
      console.log('• status - Check system status');
      console.log('• help - Show this menu');
      console.log('• exit - Quit the demo\n');

      this.isRunning = true;
      this.showPrompt();

    } catch (error) {
      console.error('❌ Failed to initialize system:', error.message);
      process.exit(1);
    }
  }

  createMockMCPClient() {
    return {
      request: async (request) => {
        const { service, operation, parameters } = request;

        // Simulate realistic service responses
        if (service === 'user-service' && operation === 'getUserProfile') {
          return {
            success: true,
            data: {
              userId: parameters.userId,
              name: 'Demo User',
              accountType: 'premium',
              accountStatus: 'active'
            }
          };
        }

        if (service === 'transaction-service' && operation === 'getUserTransactions') {
          return {
            success: true,
            data: [
              {
                transactionId: 'txn_001',
                amount: 299.99,
                merchant: 'Demo Store',
                status: 'completed',
                timestamp: new Date()
              }
            ]
          };
        }

        if (service === 'product-service' && operation === 'getProductsByCategory') {
          return {
            success: true,
            data: [
              {
                productId: 'prod_001',
                name: 'Wireless Headphones',
                category: parameters.category,
                price: 199.99,
                features: ['wireless', 'noise-cancelling']
              },
              {
                productId: 'prod_002',
                name: 'Smart Watch',
                category: parameters.category,
                price: 299.99,
                features: ['fitness-tracking', 'heart-rate']
              }
            ]
          };
        }

        return { success: false, error: { message: 'Service not available' } };
      },
      getServiceDefinition: () => ({}),
      healthCheck: () => Promise.resolve(true)
    };
  }

  createMockA2AClient() {
    return {
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      registerAgent: () => Promise.resolve(),
      publish: () => Promise.resolve({ messageId: 'msg_' + Date.now(), status: 'delivered' }),
      subscribe: () => Promise.resolve(),
      unsubscribe: () => Promise.resolve(),
      getConnectionStatus: () => 'connected',
      on: () => {},
      off: () => {},
      emit: () => {}
    };
  }

  createMockGeminiClient() {
    return {
      generateContent: () => Promise.resolve({
        success: true,
        content: 'Hello! I\'m your AI assistant. How can I help you today?',
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        processingTime: 150
      }),
      generateContentStream: () => Promise.resolve({}),
      generateStructuredResponse: () => Promise.resolve({
        success: true,
        content: '{"intent": "greeting", "confidence": 0.95}',
        structuredData: { intent: 'greeting', confidence: 0.95 },
        processingTime: 200
      })
    };
  }

  showPrompt() {
    if (!this.isRunning) return;

    this.rl.question('demo> ', (input) => {
      this.handleCommand(input.trim().toLowerCase());
    });
  }

  async handleCommand(command) {
    try {
      const [cmd, ...args] = command.split(' ');

      switch (cmd) {
        case 'chat':
          await this.handleChat(args.join(' '));
          break;

        case 'fraud':
          await this.handleFraudDetection(args.join(' '));
          break;

        case 'recommend':
          await this.handleRecommendation(args.join(' '));
          break;

        case 'status':
          this.showStatus();
          break;

        case 'help':
          this.showHelp();
          break;

        case 'exit':
        case 'quit':
          await this.shutdown();
          return;

        default:
          if (command.trim()) {
            console.log('❌ Unknown command. Type "help" for available commands.\n');
          }
      }

      if (this.isRunning) {
        this.showPrompt();
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
      this.showPrompt();
    }
  }

  async handleChat(message) {
    if (!message) {
      console.log('💬 Please provide a message to send to the chatbot.');
      console.log('Example: chat Hello, I need help with my account\n');
      return;
    }

    const chatbot = this.agents.get('chatbot-demo');
    if (!chatbot) {
      console.log('❌ Chatbot not available\n');
      return;
    }

    console.log(`🗣️  You: ${message}`);

    try {
      const sessionId = 'demo_session_' + Date.now();
      const userId = 'demo_user_123';

      const request = {
        id: 'chat_' + Date.now(),
        timestamp: new Date(),
        correlationId: 'corr_' + Date.now(),
        payload: {
          action: 'process_chat',
          sessionId,
          userId,
          message
        }
      };

      const response = await chatbot.processRequest(request);

      if (response.success && response.payload?.chatResponse) {
        const chatResponse = response.payload.chatResponse;
        console.log(`🤖 Agent: ${chatResponse.message}`);
        console.log(`📊 Intent: ${chatResponse.intent} (${Math.round(chatResponse.confidence * 100)}% confidence)`);

        if (chatResponse.requiresEscalation) {
          console.log('🚨 This conversation has been flagged for human review');
        }

        if (chatResponse.suggestedActions && chatResponse.suggestedActions.length > 0) {
          console.log(`💡 Suggested actions: ${chatResponse.suggestedActions.join(', ')}`);
        }
      } else {
        console.log('🤖 Agent: I apologize, but I encountered an error processing your request.');
      }

    } catch (error) {
      console.log('🤖 Agent: I apologize, but I encountered an error processing your request.');
    }

    console.log('');
  }

  async handleFraudDetection(transactionData) {
    const fraudAgent = this.agents.get('fraud-detection-demo');
    if (!fraudAgent) {
      console.log('❌ Fraud detection agent not available\n');
      return;
    }

    // Create a sample suspicious transaction
    const transaction = {
      transactionId: 'demo_txn_' + Date.now(),
      userId: 'demo_user_123',
      amount: transactionData ? parseFloat(transactionData) : 2500.00,
      currency: 'USD',
      merchant: 'Unknown Merchant',
      timestamp: new Date(),
      location: { country: 'US', city: 'Unknown City' },
      device: { userAgent: 'Suspicious Browser', fingerprint: 'unknown_device' }
    };

    console.log('🔍 Analyzing transaction for fraud...');
    console.log(`💳 Amount: $${transaction.amount}`);
    console.log(`🏪 Merchant: ${transaction.merchant}`);
    console.log(`📍 Location: ${transaction.location.city}, ${transaction.location.country}`);
    console.log('');

    try {
      const request = {
        id: 'fraud_' + Date.now(),
        timestamp: new Date(),
        correlationId: 'corr_' + Date.now(),
        payload: {
          action: 'analyze_transaction',
          transaction
        }
      };

      const response = await fraudAgent.processRequest(request);

      if (response.success && response.payload?.assessment) {
        const assessment = response.payload.assessment;
        console.log(`🛡️  Risk Level: ${assessment.riskLevel.toUpperCase()}`);
        console.log(`📊 Risk Score: ${assessment.riskScore || 'N/A'}`);
        console.log(`🎯 Recommendation: ${assessment.recommendation || 'Review'}`);

        if (assessment.riskFactors && assessment.riskFactors.length > 0) {
          console.log('⚠️  Risk Factors:');
          assessment.riskFactors.forEach(factor => {
            console.log(`   • ${factor.type}: ${factor.description || 'Suspicious activity detected'}`);
          });
        }
      } else {
        console.log('❌ Failed to analyze transaction');
      }

    } catch (error) {
      console.log('❌ Error analyzing transaction:', error.message);
    }

    console.log('');
  }

  async handleRecommendation(category) {
    const recAgent = this.agents.get('recommendation-demo');
    if (!recAgent) {
      console.log('❌ Recommendation agent not available\n');
      return;
    }

    const targetCategory = category || 'electronics';
    console.log(`🎯 Getting recommendations for: ${targetCategory}`);

    try {
      const request = {
        id: 'rec_' + Date.now(),
        timestamp: new Date(),
        correlationId: 'corr_' + Date.now(),
        payload: {
          action: 'generate_recommendations',
          userId: 'demo_user_123',
          context: 'demo_request',
          filters: {
            category: targetCategory,
            limit: 3
          }
        }
      };

      const response = await recAgent.processRequest(request);

      if (response.success && response.payload?.recommendations) {
        const recommendations = response.payload.recommendations;
        console.log(`📦 Found ${recommendations.length} recommendations:\n`);

        recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec.name || 'Unknown Product'}`);
          console.log(`   💰 Price: $${rec.price || 'N/A'}`);
          console.log(`   ⭐ Score: ${rec.score ? rec.score.toFixed(2) : 'N/A'}`);
          console.log(`   📝 Reason: ${rec.reason || 'Recommended based on your preferences'}`);

          if (rec.features && rec.features.length > 0) {
            console.log(`   ✨ Features: ${rec.features.join(', ')}`);
          }
          console.log('');
        });
      } else {
        console.log('❌ No recommendations available');
      }

    } catch (error) {
      console.log('❌ Error getting recommendations:', error.message);
    }

    console.log('');
  }

  showStatus() {
    console.log('📊 System Status:\n');

    console.log(`🤖 Agents: ${this.agents.size} active`);
    this.agents.forEach((agent, id) => {
      const health = agent.getHealthStatus();
      const status = health.status === 'running' ? '🟢' : '🔴';
      console.log(`   ${status} ${agent.config.name} (${health.status})`);
    });

    console.log(`\n⏱️  Uptime: ${process.uptime().toFixed(0)} seconds`);
    console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    console.log('');
  }

  showHelp() {
    console.log('📚 Available Commands:\n');
    console.log('chat <message>     - Talk to the chatbot');
    console.log('fraud [amount]     - Test fraud detection (default: $2500)');
    console.log('recommend [category] - Get product recommendations (default: electronics)');
    console.log('status             - Show system status');
    console.log('help               - Show this help menu');
    console.log('exit               - Quit the demo\n');
    console.log('💡 Examples:');
    console.log('   chat Hello, I need help');
    console.log('   fraud 5000');
    console.log('   recommend books\n');
  }

  async shutdown() {
    console.log('\n🛑 Shutting down system...');

    this.isRunning = false;

    // Shutdown agents
    for (const [id, agent] of this.agents) {
      try {
        await agent.shutdown();
        console.log(`✅ ${agent.config.name} shut down`);
      } catch (error) {
        console.log(`❌ Error shutting down ${agent.config.name}:`, error.message);
      }
    }

    this.rl.close();
    console.log('👋 Demo completed! Thank you for trying Agentic Microservices.\n');
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the demo
async function main() {
  const demo = new InteractiveDemo();
  await demo.initialize();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Failed to start demo:', error.message);
    process.exit(1);
  });
}

module.exports = { InteractiveDemo };