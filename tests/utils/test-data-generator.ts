import { faker } from '@faker-js/faker';

export class TestDataGenerator {
  private testData: Map<string, any> = new Map();
  private customerCounter = 0;
  private transactionCounter = 0;

  async resetTestData(): Promise<void> {
    this.testData.clear();
    this.customerCounter = 0;
    this.transactionCounter = 0;
  }

  async createTestCustomer(options: Partial<TestCustomer> = {}): Promise<TestCustomer> {
    const customer: TestCustomer = {
      id: options.id || `customer_${++this.customerCounter}`,
      name: options.name || faker.person.fullName(),
      email: options.email || faker.internet.email(),
      phone: options.phone || faker.phone.number(),
      address: options.address || {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: 'US'
      },
      dateOfBirth: options.dateOfBirth || faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
      ssn: options.ssn || faker.string.numeric(9),
      accountNumber: options.accountNumber || faker.finance.accountNumber(),
      balance: options.balance || parseFloat(faker.finance.amount(1000, 50000, 2)),
      creditScore: options.creditScore || faker.number.int({ min: 300, max: 850 }),
      createdAt: options.createdAt || faker.date.past({ years: 5 }),
      location: options.location || 'New York, NY',
      newUser: options.newUser || false
    };

    this.testData.set(`customer_${customer.id}`, customer);
    return customer;
  }

  async createMultipleCustomers(count: number): Promise<TestCustomer[]> {
    const customers: TestCustomer[] = [];
    for (let i = 0; i < count; i++) {
      customers.push(await this.createTestCustomer());
    }
    return customers;
  }

  async createTestTransactions(customerId: string, count: number): Promise<TestTransaction[]> {
    const transactions: TestTransaction[] = [];
    for (let i = 0; i < count; i++) {
      transactions.push(await this.createTestTransaction(customerId));
    }
    return transactions;
  }

  async createTestTransaction(customerId: string, options: Partial<TestTransaction> = {}): Promise<TestTransaction> {
    const transaction: TestTransaction = {
      id: options.id || `txn_${++this.transactionCounter}`,
      customerId,
      amount: options.amount || parseFloat(faker.finance.amount(10, 1000, 2)),
      merchant: options.merchant || faker.company.name(),
      merchantCategory: options.merchantCategory || faker.helpers.arrayElement([
        'grocery', 'gas', 'restaurant', 'retail', 'online', 'entertainment', 'healthcare', 'utilities'
      ]),
      location: options.location || `${faker.location.city()}, ${faker.location.state()}`,
      timestamp: options.timestamp || faker.date.recent({ days: 30 }),
      type: options.type || faker.helpers.arrayElement(['purchase', 'withdrawal', 'deposit', 'transfer']),
      status: options.status || 'completed',
      description: options.description || `Purchase at ${options.merchant || faker.company.name()}`,
      coordinates: options.coordinates || {
        lat: parseFloat(faker.location.latitude()),
        lng: parseFloat(faker.location.longitude())
      }
    };

    this.testData.set(`transaction_${transaction.id}`, transaction);
    return transaction;
  }

  async createSuspiciousTransactionPattern(customerId: string): Promise<TestTransaction[]> {
    const baseAmount = 50;
    const transactions: TestTransaction[] = [];
    
    // Create pattern: increasing amounts in short time span
    for (let i = 0; i < 5; i++) {
      const transaction = await this.createTestTransaction(customerId, {
        amount: baseAmount * Math.pow(2, i), // Exponentially increasing amounts
        timestamp: new Date(Date.now() - (5 - i) * 60000), // 1 minute apart
        location: 'Las Vegas, NV', // High-risk location
        merchantCategory: 'entertainment'
      });
      transactions.push(transaction);
    }
    
    return transactions;
  }

  async createNormalBankingPattern(customerId: string, days: number = 30): Promise<TestTransaction[]> {
    const transactions: TestTransaction[] = [];
    const dailyTransactions = 2; // Average 2 transactions per day
    
    for (let day = 0; day < days; day++) {
      const transactionsToday = faker.number.int({ min: 0, max: 4 });
      
      for (let i = 0; i < transactionsToday; i++) {
        const transaction = await this.createTestTransaction(customerId, {
          amount: parseFloat(faker.finance.amount(20, 200, 2)),
          timestamp: faker.date.recent({ days: days - day }),
          merchantCategory: faker.helpers.arrayElement(['grocery', 'gas', 'restaurant']),
          location: 'New York, NY' // Consistent location
        });
        transactions.push(transaction);
      }
    }
    
    return transactions;
  }

  async createAnomalousBankingActivity(customerId: string): Promise<TestTransaction> {
    return this.createTestTransaction(customerId, {
      amount: 10000, // Very large amount
      timestamp: new Date(),
      location: 'Moscow, Russia', // Unusual location
      merchantCategory: 'jewelry',
      merchant: 'Luxury Jewelry International'
    });
  }

  async createUnusualShoppingPattern(customerId: string): Promise<TestTransaction[]> {
    const transactions: TestTransaction[] = [];
    
    // Multiple high-value electronics purchases in short time
    const categories = ['electronics', 'electronics', 'electronics'];
    const merchants = ['Best Buy', 'Apple Store', 'Amazon'];
    
    for (let i = 0; i < 3; i++) {
      const transaction = await this.createTestTransaction(customerId, {
        amount: parseFloat(faker.finance.amount(1500, 3000, 2)),
        timestamp: new Date(Date.now() - i * 30000), // 30 seconds apart
        merchantCategory: categories[i],
        merchant: merchants[i]
      });
      transactions.push(transaction);
    }
    
    return transactions;
  }

  async createFraudulentTransaction(customerId: string): Promise<TestTransaction> {
    return this.createTestTransaction(customerId, {
      amount: 5000,
      timestamp: new Date(),
      location: 'Unknown Location',
      merchantCategory: 'cash_advance',
      merchant: 'ATM Withdrawal',
      type: 'withdrawal'
    });
  }

  async createHighRiskTransaction(customerId: string): Promise<TestTransaction> {
    return this.createTestTransaction(customerId, {
      amount: 15000,
      timestamp: new Date(),
      location: 'Lagos, Nigeria',
      merchantCategory: 'money_transfer',
      merchant: 'International Wire Transfer'
    });
  }

  async createTestOrder(customerId: string, options: Partial<TestOrder> = {}): Promise<TestOrder> {
    const order: TestOrder = {
      id: options.id || `order_${faker.string.alphanumeric(8)}`,
      customerId,
      items: options.items || this.generateOrderItems(),
      totalAmount: options.totalAmount || parseFloat(faker.finance.amount(50, 500, 2)),
      status: options.status || faker.helpers.arrayElement(['pending', 'processing', 'shipped', 'delivered']),
      orderDate: options.orderDate || faker.date.recent({ days: 7 }),
      shippingAddress: options.shippingAddress || {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: 'US'
      }
    };

    this.testData.set(`order_${order.id}`, order);
    return order;
  }

  async createPurchaseHistory(customerId: string, preferences: any): Promise<TestTransaction[]> {
    const transactions: TestTransaction[] = [];
    const { categories, brands, priceRange, frequency } = preferences;
    
    const transactionCount = frequency === 'weekly' ? 12 : frequency === 'monthly' ? 3 : 6;
    
    for (let i = 0; i < transactionCount; i++) {
      const category = faker.helpers.arrayElement(categories);
      const brand = brands ? faker.helpers.arrayElement(brands) : faker.company.name();
      const amount = faker.number.float({ 
        min: priceRange[0], 
        max: priceRange[1], 
        fractionDigits: 2 
      });
      
      const transaction = await this.createTestTransaction(customerId, {
        amount,
        merchantCategory: category,
        merchant: brand,
        timestamp: faker.date.past({ years: 1 })
      });
      
      transactions.push(transaction);
    }
    
    return transactions;
  }

  async createFinancialProfile(customerId: string, profile: any): Promise<FinancialProfile> {
    const financialProfile: FinancialProfile = {
      customerId,
      income: profile.income || faker.number.int({ min: 30000, max: 150000 }),
      savingsGoal: profile.savingsGoal || faker.helpers.arrayElement(['retirement', 'house', 'education', 'emergency']),
      riskTolerance: profile.riskTolerance || faker.helpers.arrayElement(['conservative', 'moderate', 'aggressive']),
      currentProducts: profile.currentProducts || ['checking_account'],
      creditScore: profile.creditScore || faker.number.int({ min: 300, max: 850 }),
      monthlyExpenses: profile.monthlyExpenses || faker.number.int({ min: 2000, max: 8000 }),
      investmentExperience: profile.investmentExperience || faker.helpers.arrayElement(['none', 'beginner', 'intermediate', 'advanced'])
    };

    this.testData.set(`financial_profile_${customerId}`, financialProfile);
    return financialProfile;
  }

  async createSeasonalPurchaseHistory(customerId: string, category: string): Promise<TestTransaction[]> {
    const transactions: TestTransaction[] = [];
    
    // Create seasonal pattern (e.g., winter sports equipment in winter months)
    const winterMonths = [11, 0, 1, 2]; // Nov, Dec, Jan, Feb
    
    for (let i = 0; i < 8; i++) {
      const month = faker.helpers.arrayElement(winterMonths);
      const date = new Date();
      date.setMonth(month);
      date.setDate(faker.number.int({ min: 1, max: 28 }));
      
      const transaction = await this.createTestTransaction(customerId, {
        merchantCategory: category,
        timestamp: date,
        amount: parseFloat(faker.finance.amount(100, 800, 2))
      });
      
      transactions.push(transaction);
    }
    
    return transactions;
  }

  async setSeasonalContext(season: string): Promise<void> {
    this.testData.set('seasonal_context', { season, timestamp: new Date() });
  }

  async createSimilarCustomers(targetCustomerId: string, count: number): Promise<TestCustomer[]> {
    const targetCustomer = this.testData.get(`customer_${targetCustomerId}`);
    if (!targetCustomer) throw new Error('Target customer not found');
    
    const similarCustomers: TestCustomer[] = [];
    
    for (let i = 0; i < count; i++) {
      const customer = await this.createTestCustomer({
        // Similar demographics
        dateOfBirth: new Date(targetCustomer.dateOfBirth.getTime() + faker.number.int({ min: -5, max: 5 }) * 365 * 24 * 60 * 60 * 1000),
        balance: targetCustomer.balance * faker.number.float({ min: 0.8, max: 1.2 }),
        creditScore: targetCustomer.creditScore + faker.number.int({ min: -50, max: 50 }),
        location: targetCustomer.location // Same location
      });
      
      similarCustomers.push(customer);
    }
    
    return similarCustomers;
  }

  async createSimilarPurchasePattern(customerId: string, targetCustomerId: string): Promise<void> {
    const targetTransactions = Array.from(this.testData.values())
      .filter(item => item.customerId === targetCustomerId && item.amount !== undefined);
    
    if (targetTransactions.length === 0) return;
    
    // Create similar transactions for the customer
    for (let i = 0; i < Math.min(5, targetTransactions.length); i++) {
      const targetTxn = targetTransactions[i];
      await this.createTestTransaction(customerId, {
        merchantCategory: targetTxn.merchantCategory,
        amount: targetTxn.amount * faker.number.float({ min: 0.8, max: 1.2 }),
        timestamp: faker.date.recent({ days: 30 })
      });
    }
  }

  async createLabeledFraudTestSet(count: number): Promise<LabeledTransaction[]> {
    const testSet: LabeledTransaction[] = [];
    const fraudCount = Math.floor(count * 0.1); // 10% fraud
    
    // Create fraudulent transactions
    for (let i = 0; i < fraudCount; i++) {
      const customer = await this.createTestCustomer();
      const transaction = await this.createFraudulentTransaction(customer.id);
      testSet.push({ ...transaction, isFraud: true });
    }
    
    // Create legitimate transactions
    for (let i = 0; i < count - fraudCount; i++) {
      const customer = await this.createTestCustomer();
      const transaction = await this.createTestTransaction(customer.id, {
        amount: parseFloat(faker.finance.amount(10, 500, 2)),
        merchantCategory: faker.helpers.arrayElement(['grocery', 'gas', 'restaurant'])
      });
      testSet.push({ ...transaction, isFraud: false });
    }
    
    return this.shuffleArray(testSet);
  }

  async createLegitimateTransactionSet(count: number): Promise<LabeledTransaction[]> {
    const testSet: LabeledTransaction[] = [];
    
    for (let i = 0; i < count; i++) {
      const customer = await this.createTestCustomer();
      const transaction = await this.createTestTransaction(customer.id, {
        amount: parseFloat(faker.finance.amount(10, 300, 2)),
        merchantCategory: faker.helpers.arrayElement(['grocery', 'gas', 'restaurant', 'retail'])
      });
      testSet.push({ ...transaction, isFraud: false });
    }
    
    return testSet;
  }

  shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  generateChatMessages(count: number): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const messageTypes = [
      'What is my account balance?',
      'Show me my recent transactions',
      'I need help with my order',
      'How do I transfer money?',
      'What are my investment options?'
    ];
    
    for (let i = 0; i < count; i++) {
      messages.push({
        id: `msg_${i}`,
        content: faker.helpers.arrayElement(messageTypes),
        timestamp: new Date(Date.now() + i * 1000),
        type: 'user'
      });
    }
    
    return messages;
  }

  generateMessageBurst(count: number, timeSpanMs: number): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const interval = timeSpanMs / count;
    
    for (let i = 0; i < count; i++) {
      messages.push({
        id: `burst_msg_${i}`,
        content: `Message ${i + 1}`,
        timestamp: new Date(Date.now() + i * interval),
        type: 'user'
      });
    }
    
    return messages;
  }

  async createRandomTransaction(customerId: string): Promise<TestTransaction> {
    return this.createTestTransaction(customerId, {
      amount: parseFloat(faker.finance.amount(5, 2000, 2)),
      merchantCategory: faker.helpers.arrayElement([
        'grocery', 'gas', 'restaurant', 'retail', 'online', 'entertainment'
      ])
    });
  }

  async createRandomTransactions(customerId: string, count: number): Promise<TestTransaction[]> {
    const transactions: TestTransaction[] = [];
    for (let i = 0; i < count; i++) {
      transactions.push(await this.createRandomTransaction(customerId));
    }
    return transactions;
  }

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateOrderItems(): OrderItem[] {
    const itemCount = faker.number.int({ min: 1, max: 5 });
    const items: OrderItem[] = [];
    
    for (let i = 0; i < itemCount; i++) {
      items.push({
        id: faker.string.alphanumeric(8),
        name: faker.commerce.productName(),
        price: parseFloat(faker.commerce.price()),
        quantity: faker.number.int({ min: 1, max: 3 }),
        category: faker.commerce.department()
      });
    }
    
    return items;
  }
}

// Type definitions
interface TestCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: Address;
  dateOfBirth: Date;
  ssn: string;
  accountNumber: string;
  balance: number;
  creditScore: number;
  createdAt: Date;
  location?: string;
  newUser?: boolean;
}

interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface TestTransaction {
  id: string;
  customerId: string;
  amount: number;
  merchant: string;
  merchantCategory: string;
  location: string;
  timestamp: Date;
  type: string;
  status: string;
  description: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface TestOrder {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  orderDate: Date;
  shippingAddress: Address;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

interface FinancialProfile {
  customerId: string;
  income: number;
  savingsGoal: string;
  riskTolerance: string;
  currentProducts: string[];
  creditScore: number;
  monthlyExpenses: number;
  investmentExperience: string;
}

interface LabeledTransaction extends TestTransaction {
  isFraud: boolean;
}

interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'bot';
}