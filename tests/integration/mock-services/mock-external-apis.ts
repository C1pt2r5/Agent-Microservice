import { Request, Response } from 'express';
import { MockService } from './mock-service-manager';
import { TestDataGenerator } from '../../utils/test-data-generator';

export class MockExternalAPIs extends MockService {
  private dataGenerator: TestDataGenerator;
  private testData: Map<string, any> = new Map();

  constructor() {
    super();
    this.dataGenerator = new TestDataGenerator();
  }

  async initialize(): Promise<void> {
    console.log('Initializing Mock External APIs...');
    
    // Generate test data for external services
    await this.generateTestData();
    
    console.log('Mock External APIs initialized');
  }

  async cleanup(): Promise<void> {
    this.testData.clear();
    console.log('Mock External APIs cleaned up');
  }

  // User Service endpoints
  async handleGetUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const endpoint = `GET /api/users/${userId}`;
      
      const defaultResponse = this.testData.get(`user_${userId}`) || {
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345'
        },
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleUpdateUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const endpoint = `PUT /api/users/${userId}`;
      const updateData = req.body;
      
      const existingUser = this.testData.get(`user_${userId}`) || {};
      const updatedUser = { ...existingUser, ...updateData, id: userId };
      this.testData.set(`user_${userId}`, updatedUser);

      const response = await this.handleRequest(endpoint, updatedUser);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // Transaction Service endpoints
  async handleGetTransaction(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = req.params.id;
      const endpoint = `GET /api/transactions/${transactionId}`;
      
      const defaultResponse = this.testData.get(`transaction_${transactionId}`) || {
        id: transactionId,
        customerId: 'customer_1',
        amount: 100.00,
        merchant: 'Test Merchant',
        timestamp: new Date().toISOString(),
        status: 'completed'
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleCreateTransaction(req: Request, res: Response): Promise<void> {
    try {
      const endpoint = 'POST /api/transactions';
      const transactionData = req.body;
      
      const newTransaction = {
        id: `txn_${Date.now()}`,
        ...transactionData,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      this.testData.set(`transaction_${newTransaction.id}`, newTransaction);

      const response = await this.handleRequest(endpoint, newTransaction);
      res.status(201).json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleGetUserTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const endpoint = `GET /api/users/${userId}/transactions`;
      
      const userTransactions = Array.from(this.testData.values())
        .filter(item => item.customerId === userId && item.amount !== undefined)
        .slice(0, 20);

      const defaultResponse = {
        userId,
        transactions: userTransactions,
        total: userTransactions.length,
        page: 1,
        limit: 20
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // Product Service endpoints
  async handleGetProducts(req: Request, res: Response): Promise<void> {
    try {
      const endpoint = 'GET /api/products';
      const { category, limit = 20, page = 1 } = req.query;
      
      let products = Array.from(this.testData.values())
        .filter(item => item.category !== undefined);
      
      if (category) {
        products = products.filter(product => product.category === category);
      }
      
      const startIndex = (Number(page) - 1) * Number(limit);
      const paginatedProducts = products.slice(startIndex, startIndex + Number(limit));

      const defaultResponse = {
        products: paginatedProducts,
        total: products.length,
        page: Number(page),
        limit: Number(limit)
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
      const endpoint = `GET /api/products/${productId}`;
      
      const defaultResponse = this.testData.get(`product_${productId}`) || {
        id: productId,
        name: 'Test Product',
        category: 'electronics',
        price: 99.99,
        description: 'A test product',
        inStock: true,
        rating: 4.5,
        reviews: 100
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // Order Service endpoints
  async handleGetOrder(req: Request, res: Response): Promise<void> {
    try {
      const orderId = req.params.id;
      const endpoint = `GET /api/orders/${orderId}`;
      
      const defaultResponse = this.testData.get(`order_${orderId}`) || {
        id: orderId,
        customerId: 'customer_1',
        items: [
          { id: 'item_1', name: 'Test Item', price: 50.00, quantity: 2 }
        ],
        totalAmount: 100.00,
        status: 'processing',
        orderDate: new Date().toISOString()
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleCreateOrder(req: Request, res: Response): Promise<void> {
    try {
      const endpoint = 'POST /api/orders';
      const orderData = req.body;
      
      const newOrder = {
        id: `order_${Date.now()}`,
        ...orderData,
        orderDate: new Date().toISOString(),
        status: 'pending'
      };
      
      this.testData.set(`order_${newOrder.id}`, newOrder);

      const response = await this.handleRequest(endpoint, newOrder);
      res.status(201).json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleGetUserOrders(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const endpoint = `GET /api/users/${userId}/orders`;
      
      const userOrders = Array.from(this.testData.values())
        .filter(item => item.customerId === userId && item.items !== undefined)
        .slice(0, 10);

      const defaultResponse = {
        userId,
        orders: userOrders,
        total: userOrders.length,
        page: 1,
        limit: 10
      };

      const response = await this.handleRequest(endpoint, defaultResponse);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async generateTestData(): Promise<void> {
    // Generate test users
    const users = await this.dataGenerator.createMultipleCustomers(100);
    users.forEach(user => {
      this.testData.set(`user_${user.id}`, user);
    });

    // Generate test transactions
    for (const user of users) {
      const transactions = await this.dataGenerator.createTestTransactions(user.id, 15);
      transactions.forEach(transaction => {
        this.testData.set(`transaction_${transaction.id}`, transaction);
      });
    }

    // Generate test orders
    for (const user of users) {
      const orderCount = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < orderCount; i++) {
        const order = await this.dataGenerator.createTestOrder(user.id);
        this.testData.set(`order_${order.id}`, order);
      }
    }

    // Generate test products
    const categories = ['electronics', 'clothing', 'books', 'home', 'sports', 'beauty'];
    for (const category of categories) {
      for (let i = 0; i < 20; i++) {
        const product = {
          id: `${category}_${i}`,
          name: `${category} Product ${i}`,
          category,
          price: Math.floor(Math.random() * 1000) + 10,
          description: `A great ${category} product`,
          inStock: Math.random() > 0.1,
          rating: Math.random() * 5,
          reviews: Math.floor(Math.random() * 1000)
        };
        this.testData.set(`product_${product.id}`, product);
      }
    }
  }
}