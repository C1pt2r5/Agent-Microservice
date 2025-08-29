import { Request, Response } from 'express';
import { MockService } from './mock-service-manager';
import { TestDataGenerator } from '../../utils/test-data-generator';

export class MockMCPService extends MockService {
  private dataGenerator: TestDataGenerator;
  private testData: Map<string, any> = new Map();

  constructor() {
    super();
    this.dataGenerator = new TestDataGenerator();
  }

  async initialize(): Promise<void> {
    console.log('Initializing Mock MCP Service...');
    
    // Generate test data
    await this.generateTestData();
    
    console.log('Mock MCP Service initialized');
  }

  async cleanup(): Promise<void> {
    this.testData.clear();
    console.log('Mock MCP Service cleaned up');
  }

  async handleGetUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const endpoint = `GET /users/${userId}`;
      
      const defaultResponse = this.testData.get(`user_${userId}`) || {
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
        status: 'active'
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleGetTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const endpoint = `GET /users/${userId}/transactions`;
      
      const userTransactions = Array.from(this.testData.values())
        .filter(item => item.customerId === userId && item.amount !== undefined)
        .slice(0, 10); // Limit to 10 transactions

      const defaultResponse = {
        userId,
        transactions: userTransactions,
        total: userTransactions.length
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleGetOrders(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const endpoint = `GET /users/${userId}/orders`;
      
      const userOrders = Array.from(this.testData.values())
        .filter(item => item.customerId === userId && item.items !== undefined)
        .slice(0, 5); // Limit to 5 orders

      const defaultResponse = {
        userId,
        orders: userOrders,
        total: userOrders.length
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleGetAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const endpoint = `GET /users/${userId}/account`;
      
      const user = this.testData.get(`user_${userId}`);
      const defaultResponse = {
        userId,
        accountNumber: user?.accountNumber || '1234567890',
        balance: user?.balance || 1000.00,
        accountType: 'checking',
        status: 'active'
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleGetProducts(req: Request, res: Response): Promise<void> {
    try {
      const endpoint = 'GET /products';
      
      const products = Array.from(this.testData.values())
        .filter(item => item.category !== undefined)
        .slice(0, 20); // Limit to 20 products

      const defaultResponse = {
        products,
        total: products.length,
        page: 1,
        limit: 20
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleGetProduct(req: Request, res: Response): Promise<void> {
    try {
      const productId = req.params.id;
      const endpoint = `GET /products/${productId}`;
      
      const defaultResponse = this.testData.get(`product_${productId}`) || {
        id: productId,
        name: 'Test Product',
        category: 'electronics',
        price: 99.99,
        inStock: true
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async generateTestData(): Promise<void> {
    // Generate test customers
    const customers = await this.dataGenerator.createMultipleCustomers(50);
    customers.forEach(customer => {
      this.testData.set(`user_${customer.id}`, customer);
    });

    // Generate test transactions
    for (const customer of customers) {
      const transactions = await this.dataGenerator.createTestTransactions(customer.id, 10);
      transactions.forEach(transaction => {
        this.testData.set(`transaction_${transaction.id}`, transaction);
      });
    }

    // Generate test orders
    for (const customer of customers) {
      const orders = await this.dataGenerator.createTestOrder(customer.id);
      this.testData.set(`order_${orders.id}`, orders);
    }

    // Generate test products
    const categories = ['electronics', 'clothing', 'books', 'home'];
    for (const category of categories) {
      for (let i = 0; i < 10; i++) {
        const product = {
          id: `${category}_${i}`,
          name: `${category} Product ${i}`,
          category,
          price: Math.floor(Math.random() * 500) + 10,
          inStock: Math.random() > 0.1
        };
        this.testData.set(`product_${product.id}`, product);
      }
    }
  }
}