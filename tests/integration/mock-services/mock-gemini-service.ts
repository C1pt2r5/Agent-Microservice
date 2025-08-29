import { Request, Response } from 'express';
import { MockService } from './mock-service-manager';

export class MockGeminiService extends MockService {
  private modelResponses: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    console.log('Initializing Mock Gemini Service...');
    
    // Setup default model responses
    this.setupDefaultResponses();
    
    console.log('Mock Gemini Service initialized');
  }

  async cleanup(): Promise<void> {
    this.modelResponses.clear();
    console.log('Mock Gemini Service cleaned up');
  }

  async handleGenerateContent(req: Request, res: Response): Promise<void> {
    try {
      const model = req.params.model;
      const endpoint = `POST /v1/models/${model}:generateContent`;
      const { contents, generationConfig } = req.body;
      
      // Extract the user's prompt
      const userPrompt = contents?.[0]?.parts?.[0]?.text || 'No prompt provided';
      
      // Generate appropriate response based on prompt content
      const generatedResponse = this.generateResponseForPrompt(userPrompt, model);
      
      const defaultResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: generatedResponse
                }
              ],
              role: 'model'
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: [
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                probability: 'NEGLIGIBLE'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                probability: 'NEGLIGIBLE'
              },
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                probability: 'NEGLIGIBLE'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                probability: 'NEGLIGIBLE'
              }
            ]
          }
        ],
        promptFeedback: {
          safetyRatings: [
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              probability: 'NEGLIGIBLE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              probability: 'NEGLIGIBLE'
            },
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              probability: 'NEGLIGIBLE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              probability: 'NEGLIGIBLE'
            }
          ]
        }
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ 
        error: {
          code: 500,
          message: error instanceof Error ? error.message : 'Unknown error',
          status: 'INTERNAL'
        }
      });
    }
  }

  async handleListModels(req: Request, res: Response): Promise<void> {
    try {
      const endpoint = 'GET /v1/models';
      
      const defaultResponse = {
        models: [
          {
            name: 'models/gemini-pro',
            displayName: 'Gemini Pro',
            description: 'The best model for scaling across a wide range of tasks',
            version: '001',
            inputTokenLimit: 30720,
            outputTokenLimit: 2048,
            supportedGenerationMethods: ['generateContent', 'countTokens']
          },
          {
            name: 'models/gemini-pro-vision',
            displayName: 'Gemini Pro Vision',
            description: 'The best image understanding model to handle a broad range of applications',
            version: '001',
            inputTokenLimit: 12288,
            outputTokenLimit: 4096,
            supportedGenerationMethods: ['generateContent', 'countTokens']
          }
        ]
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ 
        error: {
          code: 500,
          message: error instanceof Error ? error.message : 'Unknown error',
          status: 'INTERNAL'
        }
      });
    }
  }

  async handleGetModel(req: Request, res: Response): Promise<void> {
    try {
      const model = req.params.model;
      const endpoint = `GET /v1/models/${model}`;
      
      const defaultResponse = {
        name: `models/${model}`,
        displayName: model.charAt(0).toUpperCase() + model.slice(1),
        description: `Mock ${model} model for testing`,
        version: '001',
        inputTokenLimit: 30720,
        outputTokenLimit: 2048,
        supportedGenerationMethods: ['generateContent', 'countTokens']
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ 
        error: {
          code: 500,
          message: error instanceof Error ? error.message : 'Unknown error',
          status: 'INTERNAL'
        }
      });
    }
  }

  private generateResponseForPrompt(prompt: string, model: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    // Fraud detection responses
    if (lowerPrompt.includes('fraud') || lowerPrompt.includes('suspicious') || lowerPrompt.includes('anomaly')) {
      if (lowerPrompt.includes('high risk') || lowerPrompt.includes('unusual')) {
        return JSON.stringify({
          riskScore: 0.85,
          riskLevel: 'HIGH',
          factors: ['unusual_amount', 'off_hours_transaction', 'new_location'],
          recommendation: 'BLOCK_TRANSACTION',
          confidence: 0.92
        });
      } else {
        return JSON.stringify({
          riskScore: 0.15,
          riskLevel: 'LOW',
          factors: ['normal_pattern'],
          recommendation: 'ALLOW_TRANSACTION',
          confidence: 0.88
        });
      }
    }
    
    // Chatbot responses
    if (lowerPrompt.includes('balance') || lowerPrompt.includes('account')) {
      return 'Your current account balance is $2,450.75. Your account is in good standing with no pending transactions.';
    }
    
    if (lowerPrompt.includes('transaction') || lowerPrompt.includes('payment')) {
      return 'I can see your recent transactions. Your last transaction was a $45.67 purchase at Coffee Shop on Main Street yesterday at 2:30 PM. Would you like me to show you more details?';
    }
    
    if (lowerPrompt.includes('order') || lowerPrompt.includes('purchase')) {
      return 'Your recent order #12345 for $89.99 was shipped yesterday and should arrive by tomorrow. You can track it using tracking number TRK123456789.';
    }
    
    // Recommendation responses
    if (lowerPrompt.includes('recommend') || lowerPrompt.includes('suggest')) {
      return JSON.stringify({
        recommendations: [
          {
            productId: 'prod_123',
            name: 'Premium Wireless Headphones',
            score: 0.92,
            reason: 'Based on your recent electronics purchases and high ratings for audio products'
          },
          {
            productId: 'prod_456',
            name: 'Smart Fitness Tracker',
            score: 0.87,
            reason: 'Complements your active lifestyle and health-focused purchases'
          }
        ],
        confidence: 0.89
      });
    }
    
    // Sentiment analysis
    if (lowerPrompt.includes('sentiment') || lowerPrompt.includes('emotion')) {
      return JSON.stringify({
        sentiment: 'POSITIVE',
        confidence: 0.85,
        emotions: {
          joy: 0.7,
          satisfaction: 0.8,
          neutral: 0.2
        }
      });
    }
    
    // Natural language understanding
    if (lowerPrompt.includes('intent') || lowerPrompt.includes('classify')) {
      return JSON.stringify({
        intent: 'account_inquiry',
        confidence: 0.91,
        entities: [
          { type: 'account_type', value: 'checking', confidence: 0.95 },
          { type: 'action', value: 'balance_check', confidence: 0.88 }
        ]
      });
    }
    
    // Default conversational response
    return `I understand you're asking about: "${prompt}". As a mock Gemini AI service, I can help you with various tasks including fraud detection, customer support, recommendations, and natural language processing. How can I assist you further?`;
  }

  private setupDefaultResponses(): void {
    // Setup some common response patterns
    this.modelResponses.set('fraud_analysis', {
      riskScore: 0.25,
      riskLevel: 'LOW',
      factors: ['normal_pattern', 'known_merchant'],
      recommendation: 'ALLOW_TRANSACTION',
      confidence: 0.89
    });
    
    this.modelResponses.set('customer_support', {
      response: 'I\'m here to help you with your banking needs. What can I assist you with today?',
      intent: 'greeting',
      confidence: 0.95
    });
    
    this.modelResponses.set('product_recommendation', {
      recommendations: [
        {
          productId: 'default_prod_1',
          name: 'Popular Product',
          score: 0.85,
          reason: 'Highly rated by similar customers'
        }
      ],
      confidence: 0.82
    });
  }

  // Method to configure specific responses for testing
  async configureModelResponse(prompt: string, response: any): Promise<void> {
    this.modelResponses.set(prompt, response);
  }

  // Method to simulate different model behaviors
  async simulateModelBehavior(behavior: 'slow' | 'error' | 'rate_limit'): Promise<void> {
    switch (behavior) {
      case 'slow':
        await this.simulateDelay(5000); // 5 second delay
        break;
      case 'error':
        await this.simulateError(500, 'Internal model error');
        break;
      case 'rate_limit':
        await this.simulateError(429, 'Rate limit exceeded');
        break;
    }
  }
}