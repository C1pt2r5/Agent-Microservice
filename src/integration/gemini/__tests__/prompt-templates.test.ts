/**
 * Unit tests for prompt templates
 */

import { PromptTemplateManager, PromptTemplate } from '../prompt-templates';

describe('PromptTemplateManager', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });
  describe('getTemplate', () => {
    it('should return existing template', () => {
      const template = PromptTemplateManager.getTemplate('chatbot-customer-support');
      
      expect(template).toBeDefined();
      expect(template?.id).toBe('chatbot-customer-support');
      expect(template?.category).toBe('chatbot');
    });

    it('should return undefined for non-existent template', () => {
      const template = PromptTemplateManager.getTemplate('non-existent');
      expect(template).toBeUndefined();
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return chatbot templates', () => {
      const templates = PromptTemplateManager.getTemplatesByCategory('chatbot');
      
      expect(templates.length).toBeGreaterThan(0);
      templates.forEach(template => {
        expect(template.category).toBe('chatbot');
      });
    });

    it('should return fraud detection templates', () => {
      const templates = PromptTemplateManager.getTemplatesByCategory('fraud-detection');
      
      expect(templates.length).toBeGreaterThan(0);
      templates.forEach(template => {
        expect(template.category).toBe('fraud-detection');
      });
    });

    it('should return recommendation templates', () => {
      const templates = PromptTemplateManager.getTemplatesByCategory('recommendation');
      
      expect(templates.length).toBeGreaterThan(0);
      templates.forEach(template => {
        expect(template.category).toBe('recommendation');
      });
    });
  });

  describe('getAllTemplates', () => {
    it('should return all available templates', () => {
      const templates = PromptTemplateManager.getAllTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      
      // Check that we have templates from different categories
      const categories = new Set(templates.map(t => t.category));
      expect(categories.has('chatbot')).toBe(true);
      expect(categories.has('fraud-detection')).toBe(true);
      expect(categories.has('recommendation')).toBe(true);
    });
  });

  describe('renderTemplate', () => {
    it('should render simple variable substitution', () => {
      const result = PromptTemplateManager.renderTemplate('chatbot-customer-support', {
        company_name: 'TestCorp',
        user_message: 'I need help with my account',
        customer_info: {
          id: '12345',
          account_type: 'premium',
          interaction_count: 3
        }
      });

      expect(result).toContain('TestCorp');
      expect(result).toContain('I need help with my account');
      expect(result).toContain('Customer ID: 12345');
      expect(result).toContain('Account Type: premium');
    });

    it('should handle conditional blocks', () => {
      const resultWithCustomerInfo = PromptTemplateManager.renderTemplate('chatbot-customer-support', {
        company_name: 'TestCorp',
        user_message: 'Help me',
        customer_info: { id: '12345', account_type: 'basic' }
      });

      const resultWithoutCustomerInfo = PromptTemplateManager.renderTemplate('chatbot-customer-support', {
        company_name: 'TestCorp',
        user_message: 'Help me'
      });

      expect(resultWithCustomerInfo).toContain('Customer ID: 12345');
      expect(resultWithoutCustomerInfo).not.toContain('Customer ID:');
    });

    it('should handle nested object properties', () => {
      const result = PromptTemplateManager.renderTemplate('fraud-transaction-analysis', {
        transaction: {
          amount: 1000,
          merchant: 'Test Store',
          location: 'New York'
        },
        customer_profile: {
          avg_transaction_amount: 200,
          frequent_locations: ['California', 'Nevada']
        }
      });

      expect(result).toContain('Amount: 1000');
      expect(result).toContain('Merchant: Test Store');
      expect(result).toContain('Typical spending: 200');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        PromptTemplateManager.renderTemplate('non-existent', {});
      }).toThrow('Template not found: non-existent');
    });
  });

  describe('validateVariables', () => {
    it('should return empty array when all variables provided', () => {
      const missing = PromptTemplateManager.validateVariables('chatbot-transaction-inquiry', {
        user_message: 'Where is my money?',
        transaction_data: { id: '123', amount: 100 },
        account_balance: 500
      });

      expect(missing).toEqual([]);
    });

    it('should return missing variables', () => {
      const missing = PromptTemplateManager.validateVariables('chatbot-transaction-inquiry', {
        user_message: 'Where is my money?'
      });

      expect(missing).toContain('transaction_data');
      expect(missing).toContain('account_balance');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        PromptTemplateManager.validateVariables('non-existent', {});
      }).toThrow('Template not found: non-existent');
    });
  });

  describe('createCustomTemplate', () => {
    it('should create and store custom template', () => {
      const customTemplate: PromptTemplate = {
        id: 'custom-test',
        name: 'Custom Test Template',
        description: 'A test template',
        template: 'Hello {{name}}, welcome to {{service}}!',
        variables: ['name', 'service'],
        category: 'general'
      };

      PromptTemplateManager.createCustomTemplate(customTemplate);

      const retrieved = PromptTemplateManager.getTemplate('custom-test');
      expect(retrieved).toEqual(customTemplate);
    });
  });

  describe('extractVariables', () => {
    it('should extract simple variables', () => {
      const template = 'Hello {{name}}, your balance is {{balance}}.';
      const variables = PromptTemplateManager.extractVariables(template);

      expect(variables).toContain('name');
      expect(variables).toContain('balance');
    });

    it('should extract nested variables', () => {
      const template = 'User {{user.name}} has {{user.balance}} in account.';
      const variables = PromptTemplateManager.extractVariables(template);

      expect(variables).toContain('user');
    });

    it('should extract conditional variables', () => {
      const template = '{{#if customer}}Welcome {{customer.name}}!{{/if}}';
      const variables = PromptTemplateManager.extractVariables(template);

      expect(variables).toContain('customer');
    });

    it('should extract loop variables', () => {
      const template = '{{#each items}}Item: {{name}}{{/each}}';
      const variables = PromptTemplateManager.extractVariables(template);

      expect(variables).toContain('items');
    });

    it('should handle complex templates', () => {
      const template = `
        Hello {{user.name}}!
        {{#if orders}}
          Your orders:
          {{#each orders}}
            - {{title}}: {{price}}
          {{/each}}
        {{/if}}
        Total: {{total}}
      `;
      
      const variables = PromptTemplateManager.extractVariables(template);

      expect(variables).toContain('user');
      expect(variables).toContain('orders');
      expect(variables).toContain('total');
    });
  });

  describe('getTemplateSuggestions', () => {
    it('should find templates by use case', () => {
      const suggestions = PromptTemplateManager.getTemplateSuggestions('customer support');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(t => t.name.toLowerCase().includes('customer'))).toBe(true);
    });

    it('should filter by category', () => {
      const suggestions = PromptTemplateManager.getTemplateSuggestions('analysis', 'fraud-detection');

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(template => {
        expect(template.category).toBe('fraud-detection');
      });
    });

    it('should return empty array for no matches', () => {
      const suggestions = PromptTemplateManager.getTemplateSuggestions('nonexistent use case');
      expect(suggestions).toEqual([]);
    });
  });

  describe('template interpolation edge cases', () => {
    beforeEach(() => {
      const testTemplate: PromptTemplate = {
        id: 'test-interpolation',
        name: 'Test Interpolation',
        description: 'Test template for interpolation',
        template: `
          Simple: {{simple}}
          Nested: {{object.property}}
          Conditional: {{#if condition}}Yes{{/if}}
          Loop: {{#each items}}{{this}} {{/each}}
          Missing: {{missing}}
        `,
        variables: ['simple', 'object', 'condition', 'items'],
        category: 'general'
      };

      PromptTemplateManager.createCustomTemplate(testTemplate);
    });

    it('should handle missing variables gracefully', () => {
      const result = PromptTemplateManager.renderTemplate('test-interpolation', {
        simple: 'value',
        object: { property: 'nested_value' }
      });

      expect(result).toContain('Simple: value');
      expect(result).toContain('Nested: nested_value');
      expect(result).toContain('Conditional: '); // Empty because condition is falsy
      expect(result).toContain('Missing: {{missing}}'); // Unchanged
    });

    it('should handle arrays in loops', () => {
      const result = PromptTemplateManager.renderTemplate('test-interpolation', {
        simple: 'test',
        object: { property: 'test' },
        items: ['apple', 'banana', 'cherry']
      });

      expect(result).toContain('apple banana cherry');
    });

    it('should handle object arrays in loops', () => {
      const template: PromptTemplate = {
        id: 'test-object-loop',
        name: 'Test Object Loop',
        description: 'Test object loop',
        template: '{{#each products}}{{name}}: ${{price}} {{/each}}',
        variables: ['products'],
        category: 'general'
      };

      PromptTemplateManager.createCustomTemplate(template);

      const result = PromptTemplateManager.renderTemplate('test-object-loop', {
        products: [
          { name: 'Apple', price: 1.50 },
          { name: 'Banana', price: 0.75 }
        ]
      });

      expect(result).toContain('Apple: $1.5');
      expect(result).toContain('Banana: $0.75');
    });
  });
});