import { TestDataGenerator } from '../utils/test-data-generator';

export class TestDataManager {
  private dataGenerator: TestDataGenerator;
  private testDataSets: Map<string, TestDataSet> = new Map();
  private cleanupTasks: CleanupTask[] = [];
  private isInitialized: boolean = false;

  constructor() {
    this.dataGenerator = new TestDataGenerator();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing Test Data Manager...');
    
    // Initialize data generator
    await this.dataGenerator.resetTestData();
    
    // Setup cleanup scheduler
    this.scheduleCleanupTasks();
    
    this.isInitialized = true;
    console.log('Test Data Manager initialized successfully');
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) return;

    console.log('Cleaning up Test Data Manager...');
    
    // Execute all cleanup tasks
    await this.executeAllCleanupTasks();
    
    // Clear data sets
    this.testDataSets.clear();
    this.cleanupTasks = [];
    
    this.isInitialized = false;
    console.log('Test Data Manager cleanup complete');
  }

  async createTestDataSet(config: TestDataSetConfig): Promise<string> {
    const dataSetId = `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const dataSet: TestDataSet = {
      id: dataSetId,
      config,
      createdAt: new Date(),
      customers: [],
      transactions: [],
      orders: [],
      products: [],
      status: 'creating'
    };

    this.testDataSets.set(dataSetId, dataSet);

    try {
      // Generate test data based on configuration
      await this.generateTestData(dataSet);
      
      dataSet.status = 'ready';
      
      // Schedule cleanup
      this.scheduleDataSetCleanup(dataSetId, config.ttl || 3600000); // Default 1 hour TTL
      
      console.log(`Test data set ${dataSetId} created with ${dataSet.customers.length} customers`);
      
    } catch (error) {
      dataSet.status = 'failed';
      dataSet.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }

    return dataSetId;
  }

  async getTestDataSet(dataSetId: string): Promise<TestDataSet | undefined> {
    return this.testDataSets.get(dataSetId);
  }

  async deleteTestDataSet(dataSetId: string): Promise<void> {
    const dataSet = this.testDataSets.get(dataSetId);
    if (!dataSet) return;

    console.log(`Deleting test data set ${dataSetId}`);
    
    // Clean up generated data
    await this.cleanupDataSet(dataSet);
    
    // Remove from memory
    this.testDataSets.delete(dataSetId);
    
    // Remove cleanup task
    this.cleanupTasks = this.cleanupTasks.filter(task => task.dataSetId !== dataSetId);
  }

  async createCustomerJourneyData(scenarioType: string): Promise<CustomerJourneyData> {
    const config: TestDataSetConfig = {
      customerCount: this.getCustomerCountForScenario(scenarioType),
      transactionHistory: true,
      orderHistory: true,
      financialProfiles: true,
      fraudPatterns: scenarioType.includes('fraud'),
      seasonalData: scenarioType.includes('seasonal'),
      ttl: 7200000 // 2 hours for journey tests
    };

    const dataSetId = await this.createTestDataSet(config);
    const dataSet = this.testDataSets.get(dataSetId)!;

    return {
      dataSetId,
      customers: dataSet.customers,
      transactions: dataSet.transactions,
      orders: dataSet.orders,
      scenario: scenarioType
    };
  }

  async createFraudDetectionTestData(): Promise<FraudDetectionTestData> {
    const config: TestDataSetConfig = {
      customerCount: 500,
      transactionHistory: true,
      fraudPatterns: true,
      anomalyPatterns: true,
      labeledData: true,
      ttl: 3600000 // 1 hour
    };

    const dataSetId = await this.createTestDataSet(config);
    const dataSet = this.testDataSets.get(dataSetId)!;

    // Generate specific fraud scenarios
    const fraudScenarios = await this.generateFraudScenarios(dataSet.customers);
    const legitimatePatterns = await this.generateLegitimatePatterns(dataSet.customers);

    return {
      dataSetId,
      customers: dataSet.customers,
      fraudulentTransactions: fraudScenarios.fraudulent,
      legitimateTransactions: legitimatePatterns,
      labeledTestSet: [...fraudScenarios.fraudulent, ...legitimatePatterns],
      anomalyPatterns: fraudScenarios.anomalies
    };
  }

  async createRecommendationTestData(): Promise<RecommendationTestData> {
    const config: TestDataSetConfig = {
      customerCount: 1000,
      transactionHistory: true,
      orderHistory: true,
      productCatalog: true,
      seasonalData: true,
      demographicVariety: true,
      ttl: 7200000 // 2 hours
    };

    const dataSetId = await this.createTestDataSet(config);
    const dataSet = this.testDataSets.get(dataSetId)!;

    // Generate recommendation-specific data
    const purchasePatterns = await this.generatePurchasePatterns(dataSet.customers);
    const productCatalog = await this.generateProductCatalog();
    const customerSegments = await this.generateCustomerSegments(dataSet.customers);

    return {
      dataSetId,
      customers: dataSet.customers,
      products: productCatalog,
      purchaseHistory: purchasePatterns,
      customerSegments,
      seasonalTrends: await this.generateSeasonalTrends()
    };
  }

  async createPerformanceTestData(scale: 'small' | 'medium' | 'large'): Promise<PerformanceTestData> {
    const customerCounts = { small: 1000, medium: 10000, large: 100000 };
    const customerCount = customerCounts[scale];

    const config: TestDataSetConfig = {
      customerCount,
      transactionHistory: true,
      orderHistory: true,
      distributedGeneration: scale === 'large',
      ttl: 1800000 // 30 minutes for performance tests
    };

    const dataSetId = await this.createTestDataSet(config);
    const dataSet = this.testDataSets.get(dataSetId)!;

    return {
      dataSetId,
      scale,
      customers: dataSet.customers,
      transactions: dataSet.transactions,
      orders: dataSet.orders,
      estimatedMemoryUsage: this.estimateMemoryUsage(dataSet)
    };
  }

  async generateSyntheticWorkload(workloadType: string, intensity: number): Promise<SyntheticWorkload> {
    const workloadId = `workload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const workload: SyntheticWorkload = {
      id: workloadId,
      type: workloadType,
      intensity,
      createdAt: new Date(),
      transactions: [],
      chatMessages: [],
      apiRequests: []
    };

    switch (workloadType) {
      case 'transaction_processing':
        workload.transactions = await this.generateTransactionWorkload(intensity);
        break;
      case 'chat_interactions':
        workload.chatMessages = await this.generateChatWorkload(intensity);
        break;
      case 'api_requests':
        workload.apiRequests = await this.generateAPIWorkload(intensity);
        break;
      case 'mixed':
        workload.transactions = await this.generateTransactionWorkload(intensity * 0.4);
        workload.chatMessages = await this.generateChatWorkload(intensity * 0.3);
        workload.apiRequests = await this.generateAPIWorkload(intensity * 0.3);
        break;
    }

    // Schedule cleanup
    this.scheduleWorkloadCleanup(workloadId, 1800000); // 30 minutes

    return workload;
  }

  private async generateTestData(dataSet: TestDataSet): Promise<void> {
    const { config } = dataSet;
    
    console.log(`Generating test data for ${config.customerCount} customers...`);

    // Generate customers
    if (config.distributedGeneration && config.customerCount > 10000) {
      dataSet.customers = await this.generateCustomersDistributed(config.customerCount);
    } else {
      dataSet.customers = await this.generateCustomersBatch(config.customerCount);
    }

    // Generate transaction history
    if (config.transactionHistory) {
      dataSet.transactions = await this.generateTransactionHistory(dataSet.customers);
    }

    // Generate order history
    if (config.orderHistory) {
      dataSet.orders = await this.generateOrderHistory(dataSet.customers);
    }

    // Generate product catalog
    if (config.productCatalog) {
      dataSet.products = await this.generateProductCatalog();
    }

    // Generate financial profiles
    if (config.financialProfiles) {
      await this.generateFinancialProfiles(dataSet.customers);
    }

    // Generate fraud patterns
    if (config.fraudPatterns) {
      const fraudTransactions = await this.generateFraudPatterns(dataSet.customers);
      dataSet.transactions.push(...fraudTransactions);
    }

    // Generate seasonal data
    if (config.seasonalData) {
      const seasonalTransactions = await this.generateSeasonalPatterns(dataSet.customers);
      dataSet.transactions.push(...seasonalTransactions);
    }

    console.log(`Test data generation complete: ${dataSet.customers.length} customers, ${dataSet.transactions.length} transactions`);
  }

  private async generateCustomersBatch(count: number): Promise<any[]> {
    const customers = [];
    const batchSize = 1000;
    
    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i);
      const batch = await this.dataGenerator.createMultipleCustomers(batchCount);
      customers.push(...batch);
      
      // Progress logging for large datasets
      if (count > 10000 && i % 10000 === 0) {
        console.log(`Generated ${i + batchCount}/${count} customers`);
      }
    }
    
    return customers;
  }

  private async generateCustomersDistributed(count: number): Promise<any[]> {
    // For very large datasets, implement distributed generation
    // This could use worker threads or external services
    console.log(`Using distributed generation for ${count} customers`);
    
    const workers = 4; // Number of worker processes
    const customersPerWorker = Math.ceil(count / workers);
    const promises = [];
    
    for (let i = 0; i < workers; i++) {
      const workerCount = Math.min(customersPerWorker, count - i * customersPerWorker);
      if (workerCount > 0) {
        promises.push(this.generateCustomersBatch(workerCount));
      }
    }
    
    const results = await Promise.all(promises);
    return results.flat();
  }

  private async generateTransactionHistory(customers: any[]): Promise<any[]> {
    const transactions = [];
    
    for (const customer of customers) {
      const transactionCount = Math.floor(Math.random() * 50) + 10; // 10-60 transactions per customer
      const customerTransactions = await this.dataGenerator.createTestTransactions(customer.id, transactionCount);
      transactions.push(...customerTransactions);
    }
    
    return transactions;
  }

  private async generateOrderHistory(customers: any[]): Promise<any[]> {
    const orders = [];
    
    for (const customer of customers) {
      const orderCount = Math.floor(Math.random() * 10) + 1; // 1-10 orders per customer
      for (let i = 0; i < orderCount; i++) {
        const order = await this.dataGenerator.createTestOrder(customer.id);
        orders.push(order);
      }
    }
    
    return orders;
  }

  private async generateProductCatalog(): Promise<any[]> {
    // Generate a diverse product catalog
    const categories = ['electronics', 'clothing', 'books', 'home', 'sports', 'beauty', 'automotive'];
    const products = [];
    
    for (const category of categories) {
      const productsInCategory = Math.floor(Math.random() * 100) + 50; // 50-150 products per category
      for (let i = 0; i < productsInCategory; i++) {
        products.push({
          id: `${category}_${i}`,
          name: `${category} Product ${i}`,
          category,
          price: Math.floor(Math.random() * 1000) + 10,
          rating: Math.random() * 5,
          inStock: Math.random() > 0.1 // 90% in stock
        });
      }
    }
    
    return products;
  }

  private async generateFinancialProfiles(customers: any[]): Promise<void> {
    for (const customer of customers) {
      await this.dataGenerator.createFinancialProfile(customer.id, {
        income: Math.floor(Math.random() * 150000) + 30000,
        riskTolerance: ['conservative', 'moderate', 'aggressive'][Math.floor(Math.random() * 3)]
      });
    }
  }

  private async generateFraudPatterns(customers: any[]): Promise<any[]> {
    const fraudTransactions = [];
    const fraudCustomers = customers.slice(0, Math.floor(customers.length * 0.05)); // 5% fraud
    
    for (const customer of fraudCustomers) {
      const pattern = await this.dataGenerator.createSuspiciousTransactionPattern(customer.id);
      fraudTransactions.push(...pattern);
    }
    
    return fraudTransactions;
  }

  private async generateSeasonalPatterns(customers: any[]): Promise<any[]> {
    const seasonalTransactions = [];
    const seasonalCustomers = customers.slice(0, Math.floor(customers.length * 0.3)); // 30% seasonal
    
    for (const customer of seasonalCustomers) {
      const pattern = await this.dataGenerator.createSeasonalPurchaseHistory(customer.id, 'winter_sports');
      seasonalTransactions.push(...pattern);
    }
    
    return seasonalTransactions;
  }

  private async generateFraudScenarios(customers: any[]): Promise<{ fraudulent: any[], anomalies: any[] }> {
    const fraudulent = [];
    const anomalies = [];
    
    // Generate various fraud scenarios
    for (let i = 0; i < customers.length * 0.1; i++) {
      const customer = customers[i];
      const fraudTxn = await this.dataGenerator.createFraudulentTransaction(customer.id);
      fraudulent.push({ ...fraudTxn, isFraud: true });
    }
    
    // Generate anomaly patterns
    for (let i = 0; i < customers.length * 0.05; i++) {
      const customer = customers[i];
      const anomaly = await this.dataGenerator.createAnomalousBankingActivity(customer.id);
      anomalies.push({ ...anomaly, isAnomaly: true });
    }
    
    return { fraudulent, anomalies };
  }

  private async generateLegitimatePatterns(customers: any[]): Promise<any[]> {
    const legitimate = [];
    
    for (const customer of customers) {
      const pattern = await this.dataGenerator.createNormalBankingPattern(customer.id);
      legitimate.push(...pattern.map(txn => ({ ...txn, isFraud: false })));
    }
    
    return legitimate;
  }

  private async generatePurchasePatterns(customers: any[]): Promise<Map<string, any[]>> {
    const patterns = new Map();
    
    for (const customer of customers) {
      const purchases = await this.dataGenerator.createPurchaseHistory(customer.id, {
        categories: ['electronics', 'books', 'clothing'],
        frequency: 'monthly'
      });
      patterns.set(customer.id, purchases);
    }
    
    return patterns;
  }

  private async generateCustomerSegments(customers: any[]): Promise<Map<string, string[]>> {
    const segments = new Map();
    const segmentTypes = ['high_value', 'frequent_buyer', 'price_sensitive', 'tech_enthusiast', 'fashion_forward'];
    
    segmentTypes.forEach(segment => {
      const segmentCustomers = customers
        .filter(() => Math.random() < 0.2) // 20% chance per segment
        .map(c => c.id);
      segments.set(segment, segmentCustomers);
    });
    
    return segments;
  }

  private async generateSeasonalTrends(): Promise<any> {
    return {
      spring: ['gardening', 'outdoor', 'fashion'],
      summer: ['travel', 'sports', 'outdoor'],
      fall: ['back_to_school', 'fashion', 'home'],
      winter: ['holidays', 'winter_sports', 'indoor']
    };
  }

  private async generateTransactionWorkload(intensity: number): Promise<any[]> {
    const transactions = [];
    for (let i = 0; i < intensity; i++) {
      const customer = await this.dataGenerator.createTestCustomer();
      const transaction = await this.dataGenerator.createRandomTransaction(customer.id);
      transactions.push(transaction);
    }
    return transactions;
  }

  private async generateChatWorkload(intensity: number): Promise<any[]> {
    const messages = [];
    for (let i = 0; i < intensity; i++) {
      messages.push({
        id: `msg_${i}`,
        customerId: `customer_${Math.floor(Math.random() * 1000)}`,
        content: `Test message ${i}`,
        timestamp: new Date()
      });
    }
    return messages;
  }

  private async generateAPIWorkload(intensity: number): Promise<any[]> {
    const requests = [];
    const endpoints = ['/users', '/transactions', '/orders', '/products'];
    
    for (let i = 0; i < intensity; i++) {
      requests.push({
        id: `req_${i}`,
        endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
        method: Math.random() > 0.7 ? 'POST' : 'GET',
        timestamp: new Date()
      });
    }
    return requests;
  }

  private getCustomerCountForScenario(scenarioType: string): number {
    const counts: Record<string, number> = {
      'simple_chat': 10,
      'fraud_detection': 100,
      'recommendation': 200,
      'complex_journey': 50,
      'load_test': 1000
    };
    
    return counts[scenarioType] || 50;
  }

  private estimateMemoryUsage(dataSet: TestDataSet): number {
    // Rough estimation in MB
    const customerSize = 2; // KB per customer
    const transactionSize = 1; // KB per transaction
    const orderSize = 3; // KB per order
    
    return (
      dataSet.customers.length * customerSize +
      dataSet.transactions.length * transactionSize +
      dataSet.orders.length * orderSize
    ) / 1024; // Convert to MB
  }

  private scheduleDataSetCleanup(dataSetId: string, ttl: number): void {
    const cleanupTask: CleanupTask = {
      id: `cleanup_${dataSetId}`,
      dataSetId,
      scheduledTime: new Date(Date.now() + ttl),
      type: 'dataset'
    };
    
    this.cleanupTasks.push(cleanupTask);
    
    setTimeout(() => {
      this.deleteTestDataSet(dataSetId);
    }, ttl);
  }

  private scheduleWorkloadCleanup(workloadId: string, ttl: number): void {
    const cleanupTask: CleanupTask = {
      id: `cleanup_${workloadId}`,
      dataSetId: workloadId,
      scheduledTime: new Date(Date.now() + ttl),
      type: 'workload'
    };
    
    this.cleanupTasks.push(cleanupTask);
    
    setTimeout(() => {
      // Cleanup workload data
      console.log(`Cleaning up workload ${workloadId}`);
    }, ttl);
  }

  private scheduleCleanupTasks(): void {
    // Schedule periodic cleanup of expired data
    setInterval(() => {
      this.executeExpiredCleanupTasks();
    }, 300000); // Every 5 minutes
  }

  private async executeExpiredCleanupTasks(): Promise<void> {
    const now = new Date();
    const expiredTasks = this.cleanupTasks.filter(task => task.scheduledTime <= now);
    
    for (const task of expiredTasks) {
      try {
        if (task.type === 'dataset') {
          await this.deleteTestDataSet(task.dataSetId);
        }
        console.log(`Executed cleanup task ${task.id}`);
      } catch (error) {
        console.error(`Failed to execute cleanup task ${task.id}:`, error);
      }
    }
    
    // Remove executed tasks
    this.cleanupTasks = this.cleanupTasks.filter(task => task.scheduledTime > now);
  }

  private async executeAllCleanupTasks(): Promise<void> {
    for (const task of this.cleanupTasks) {
      try {
        if (task.type === 'dataset') {
          await this.deleteTestDataSet(task.dataSetId);
        }
      } catch (error) {
        console.error(`Failed to execute cleanup task ${task.id}:`, error);
      }
    }
  }

  private async cleanupDataSet(dataSet: TestDataSet): Promise<void> {
    // Clean up any external resources created for this data set
    // This could include database records, files, etc.
    console.log(`Cleaning up data set ${dataSet.id}`);
  }
}

// Type definitions
interface TestDataSetConfig {
  customerCount: number;
  transactionHistory?: boolean;
  orderHistory?: boolean;
  productCatalog?: boolean;
  financialProfiles?: boolean;
  fraudPatterns?: boolean;
  anomalyPatterns?: boolean;
  seasonalData?: boolean;
  demographicVariety?: boolean;
  labeledData?: boolean;
  distributedGeneration?: boolean;
  ttl?: number; // Time to live in milliseconds
}

interface TestDataSet {
  id: string;
  config: TestDataSetConfig;
  createdAt: Date;
  customers: any[];
  transactions: any[];
  orders: any[];
  products: any[];
  status: 'creating' | 'ready' | 'failed';
  error?: string;
}

interface CustomerJourneyData {
  dataSetId: string;
  customers: any[];
  transactions: any[];
  orders: any[];
  scenario: string;
}

interface FraudDetectionTestData {
  dataSetId: string;
  customers: any[];
  fraudulentTransactions: any[];
  legitimateTransactions: any[];
  labeledTestSet: any[];
  anomalyPatterns: any[];
}

interface RecommendationTestData {
  dataSetId: string;
  customers: any[];
  products: any[];
  purchaseHistory: Map<string, any[]>;
  customerSegments: Map<string, string[]>;
  seasonalTrends: any;
}

interface PerformanceTestData {
  dataSetId: string;
  scale: 'small' | 'medium' | 'large';
  customers: any[];
  transactions: any[];
  orders: any[];
  estimatedMemoryUsage: number;
}

interface SyntheticWorkload {
  id: string;
  type: string;
  intensity: number;
  createdAt: Date;
  transactions: any[];
  chatMessages: any[];
  apiRequests: any[];
}

interface CleanupTask {
  id: string;
  dataSetId: string;
  scheduledTime: Date;
  type: 'dataset' | 'workload';
}