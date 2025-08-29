/**
 * Prompt templates for different agent types and use cases
 */

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'chatbot' | 'fraud-detection' | 'recommendation' | 'general';
  examples?: PromptExample[];
}

export interface PromptExample {
  input: Record<string, any>;
  expectedOutput: string;
}

export class PromptTemplateManager {
  private static readonly TEMPLATES: Record<string, PromptTemplate> = {
    // Chatbot Templates
    'chatbot-customer-support': {
      id: 'chatbot-customer-support',
      name: 'Customer Support Chatbot',
      description: 'Template for handling customer support inquiries',
      template: `You are a helpful customer support assistant for {{company_name}}. 

Your role is to:
- Provide accurate information about products and services
- Help customers resolve issues professionally
- Escalate complex problems when necessary
- Maintain a friendly and helpful tone

Customer Context:
{{#if customer_info}}
- Customer ID: {{customer_info.id}}
- Account Type: {{customer_info.account_type}}
- Previous Interactions: {{customer_info.interaction_count}}
{{/if}}

{{#if conversation_history}}
Previous conversation:
{{conversation_history}}
{{/if}}

Customer Message: {{user_message}}

Please provide a helpful response. If you cannot resolve the issue, suggest next steps or escalation options.`,
      variables: ['company_name', 'customer_info', 'conversation_history', 'user_message'],
      category: 'chatbot',
      examples: [
        {
          input: {
            company_name: 'TechCorp',
            user_message: 'I forgot my password',
            customer_info: { id: '12345', account_type: 'premium' }
          },
          expectedOutput: 'I can help you reset your password. As a premium customer, you have access to our priority support...'
        }
      ]
    },

    'chatbot-transaction-inquiry': {
      id: 'chatbot-transaction-inquiry',
      name: 'Transaction Inquiry Handler',
      description: 'Template for handling transaction-related questions',
      template: `You are a banking assistant helping customers with transaction inquiries.

Customer Request: {{user_message}}

{{#if transaction_data}}
Transaction Information:
- Transaction ID: {{transaction_data.id}}
- Amount: {{transaction_data.amount}}
- Date: {{transaction_data.date}}
- Merchant: {{transaction_data.merchant}}
- Status: {{transaction_data.status}}
{{/if}}

{{#if account_balance}}
Current Account Balance: {{account_balance}}
{{/if}}

Provide a clear explanation about the transaction. If there are any concerns, explain the next steps for resolution.`,
      variables: ['user_message', 'transaction_data', 'account_balance'],
      category: 'chatbot'
    },

    // Fraud Detection Templates
    'fraud-transaction-analysis': {
      id: 'fraud-transaction-analysis',
      name: 'Transaction Fraud Analysis',
      description: 'Template for analyzing transactions for fraud indicators',
      template: `Analyze the following transaction for potential fraud indicators:

Transaction Details:
- Amount: {{transaction.amount}}
- Merchant: {{transaction.merchant}}
- Location: {{transaction.location}}
- Time: {{transaction.timestamp}}
- Payment Method: {{transaction.payment_method}}

Customer Profile:
- Typical spending: {{customer_profile.avg_transaction_amount}}
- Usual locations: {{customer_profile.frequent_locations}}
- Account age: {{customer_profile.account_age}}
- Previous fraud incidents: {{customer_profile.fraud_history}}

{{#if recent_transactions}}
Recent Transaction Pattern:
{{recent_transactions}}
{{/if}}

Analyze this transaction and provide:
1. Risk score (0-100, where 100 is highest risk)
2. Key risk factors identified
3. Recommended action (approve, review, decline)
4. Explanation of reasoning

Format your response as JSON with the following structure:
{
  "risk_score": number,
  "risk_factors": [string],
  "recommendation": "approve|review|decline",
  "explanation": "string"
}`,
      variables: ['transaction', 'customer_profile', 'recent_transactions'],
      category: 'fraud-detection'
    },

    'fraud-pattern-detection': {
      id: 'fraud-pattern-detection',
      name: 'Fraud Pattern Detection',
      description: 'Template for detecting fraud patterns across multiple transactions',
      template: `Analyze the following transaction sequence for fraud patterns:

Transaction Sequence:
{{transaction_sequence}}

Customer Behavior Baseline:
{{customer_baseline}}

Known Fraud Patterns:
- Rapid successive transactions
- Unusual geographic patterns
- Amount escalation patterns
- Time-based anomalies
- Merchant category deviations

Identify any suspicious patterns and provide:
1. Pattern type detected
2. Confidence level (0-100)
3. Supporting evidence
4. Risk assessment
5. Recommended monitoring or actions`,
      variables: ['transaction_sequence', 'customer_baseline'],
      category: 'fraud-detection'
    },

    // Recommendation Templates
    'recommendation-product': {
      id: 'recommendation-product',
      name: 'Product Recommendation',
      description: 'Template for generating product recommendations',
      template: `Generate personalized product recommendations for the customer:

Customer Profile:
- Demographics: {{customer.demographics}}
- Purchase History: {{customer.purchase_history}}
- Preferences: {{customer.preferences}}
- Budget Range: {{customer.budget_range}}

Available Products:
{{available_products}}

{{#if current_context}}
Current Context:
{{current_context}}
{{/if}}

Generate 3-5 product recommendations with:
1. Product name and brief description
2. Why it matches the customer's profile
3. Confidence score (0-100)
4. Expected customer satisfaction likelihood

Format as JSON array:
[
  {
    "product_id": "string",
    "product_name": "string",
    "description": "string",
    "match_reason": "string",
    "confidence_score": number,
    "satisfaction_likelihood": number
  }
]`,
      variables: ['customer', 'available_products', 'current_context'],
      category: 'recommendation'
    },

    'recommendation-financial-services': {
      id: 'recommendation-financial-services',
      name: 'Financial Services Recommendation',
      description: 'Template for recommending financial products and services',
      template: `Recommend appropriate financial services for the customer:

Customer Financial Profile:
- Income: {{customer.income}}
- Age: {{customer.age}}
- Financial Goals: {{customer.goals}}
- Risk Tolerance: {{customer.risk_tolerance}}
- Current Products: {{customer.current_products}}
- Credit Score Range: {{customer.credit_score_range}}

Available Services:
{{available_services}}

Market Conditions:
{{market_conditions}}

Provide recommendations considering:
1. Customer's financial situation and goals
2. Risk profile alignment
3. Product suitability
4. Potential benefits and risks
5. Timing considerations

Format recommendations with clear explanations of benefits and suitability.`,
      variables: ['customer', 'available_services', 'market_conditions'],
      category: 'recommendation'
    },

    // General Templates
    'general-data-analysis': {
      id: 'general-data-analysis',
      name: 'General Data Analysis',
      description: 'Template for analyzing structured data',
      template: `Analyze the following data and provide insights:

Data:
{{data}}

Analysis Requirements:
{{analysis_requirements}}

Please provide:
1. Key findings and patterns
2. Statistical insights
3. Anomalies or outliers
4. Trends and correlations
5. Actionable recommendations

Format your analysis clearly with supporting evidence for each finding.`,
      variables: ['data', 'analysis_requirements'],
      category: 'general'
    },

    'general-classification': {
      id: 'general-classification',
      name: 'General Classification',
      description: 'Template for classifying text or data into categories',
      template: `Classify the following input into the appropriate category:

Input: {{input_text}}

Categories:
{{categories}}

{{#if classification_criteria}}
Classification Criteria:
{{classification_criteria}}
{{/if}}

Provide:
1. Primary category
2. Confidence score (0-100)
3. Reasoning for classification
4. Alternative categories if applicable

Format as JSON:
{
  "primary_category": "string",
  "confidence_score": number,
  "reasoning": "string",
  "alternatives": [{"category": "string", "score": number}]
}`,
      variables: ['input_text', 'categories', 'classification_criteria'],
      category: 'general'
    }
  };

  /**
   * Get a template by ID
   */
  static getTemplate(templateId: string): PromptTemplate | undefined {
    return this.TEMPLATES[templateId];
  }

  /**
   * Get all templates for a specific category
   */
  static getTemplatesByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return Object.values(this.TEMPLATES).filter(template => template.category === category);
  }

  /**
   * Get all available templates
   */
  static getAllTemplates(): PromptTemplate[] {
    return Object.values(this.TEMPLATES);
  }

  /**
   * Render a template with provided variables
   */
  static renderTemplate(templateId: string, variables: Record<string, any>): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return this.interpolateTemplate(template.template, variables);
  }

  /**
   * Validate that all required variables are provided
   */
  static validateVariables(templateId: string, variables: Record<string, any>): string[] {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const missingVariables: string[] = [];
    
    for (const variable of template.variables) {
      if (!(variable in variables)) {
        missingVariables.push(variable);
      }
    }

    return missingVariables;
  }

  /**
   * Create a custom template
   */
  static createCustomTemplate(template: PromptTemplate): void {
    this.TEMPLATES[template.id] = template;
  }

  /**
   * Simple template interpolation
   */
  private static interpolateTemplate(template: string, variables: Record<string, any>): string {
    let result = template;

    // Handle simple variable substitution {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (_, variable) => {
      return variables[variable] !== undefined ? String(variables[variable]) : `{{${variable}}}`;
    });

    // Handle nested object access {{object.property}}
    result = result.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_, object, property) => {
      const obj = variables[object];
      if (obj && typeof obj === 'object' && property in obj) {
        return String(obj[property]);
      }
      return `{{${object}.${property}}}`;
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
      const value = variables[variable];
      return value ? content : '';
    });

    // Handle loops {{#each array}}...{{/each}} (basic implementation)
    result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, variable, content) => {
      const array = variables[variable];
      if (Array.isArray(array)) {
        return array.map(item => {
          let itemContent = content;
          if (typeof item === 'object') {
            Object.keys(item).forEach(key => {
              itemContent = itemContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(item[key]));
            });
          } else {
            itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
          }
          return itemContent;
        }).join('');
      }
      return '';
    });

    return result;
  }

  /**
   * Extract variables from a template string
   */
  static extractVariables(templateString: string): string[] {
    const variables = new Set<string>();
    
    // Find all template expressions
    const allMatches = templateString.match(/\{\{[^}]+\}\}/g);
    if (!allMatches) {
      return [];
    }

    allMatches.forEach(match => {
      const content = match.replace(/\{\{|\}\}/g, '').trim();
      
      // Handle conditional blocks {{#if variable}}
      if (content.startsWith('#if ')) {
        const variable = content.replace('#if ', '');
        variables.add(variable);
      }
      // Handle loop blocks {{#each variable}}
      else if (content.startsWith('#each ')) {
        const variable = content.replace('#each ', '');
        variables.add(variable);
      }
      // Handle nested variables {{object.property}}
      else if (content.includes('.')) {
        const [object] = content.split('.');
        variables.add(object);
      }
      // Handle simple variables {{variable}} (but skip 'this' and closing tags)
      else if (!content.startsWith('/') && content !== 'this') {
        variables.add(content);
      }
    });

    return Array.from(variables);
  }

  /**
   * Get template suggestions based on use case
   */
  static getTemplateSuggestions(useCase: string, category?: PromptTemplate['category']): PromptTemplate[] {
    const templates = category ? this.getTemplatesByCategory(category) : this.getAllTemplates();
    
    return templates.filter(template => 
      template.name.toLowerCase().includes(useCase.toLowerCase()) ||
      template.description.toLowerCase().includes(useCase.toLowerCase())
    );
  }
}