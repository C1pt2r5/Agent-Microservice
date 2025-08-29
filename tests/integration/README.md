# Integration Test Framework

This comprehensive integration test framework provides automated testing capabilities for the agentic microservices system, including agent communication testing, mock services for external dependencies, automated test data generation and cleanup, and CI/CD pipeline integration.

## Features

### 🔧 Core Components

- **Test Harness**: Orchestrates agent communication testing and session management
- **Mock Service Manager**: Provides mock implementations for external dependencies
- **Test Data Manager**: Generates and manages test data with automatic cleanup
- **Test Reporter**: Generates comprehensive reports in multiple formats (JSON, HTML, CSV)
- **Test Environment**: Manages test environment setup and service orchestration

### 🤖 Mock Services

- **Mock MCP Service**: Simulates Model Context Protocol endpoints
- **Mock External APIs**: Mocks existing microservice APIs (User, Transaction, Product, Order services)
- **Mock Gemini Service**: Simulates Google Gemini AI responses for testing
- **Mock Redis Service**: In-memory Redis implementation for testing

### 📊 Test Types

- **Agent Communication Tests**: Test inter-agent messaging via A2A protocol
- **End-to-End Tests**: Complete user journey testing across all agents
- **Load Tests**: Performance testing with configurable load patterns
- **Failure Recovery Tests**: Resilience testing with simulated failures

## Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Start required services (if using Docker)
npm run docker:compose:up
```

### Running Tests

```bash
# Run all integration tests
npm run test:integration:all

# Run specific test suites
npm run test:integration:agent-communication
npm run test:integration:end-to-end
npm run test:integration:performance

# Run with Jest directly
npm run test:integration
```

### Using the Framework Programmatically

```typescript
import { IntegrationTestFramework } from './integration-test-framework';

const framework = new IntegrationTestFramework({
  reportDirectory: 'test-reports',
  mockServices: true,
  parallelExecution: false,
  generateReports: true
});

await framework.initialize();

// Run a communication test
const results = await framework.runAgentCommunicationTest({
  testName: 'Basic Agent Communication',
  agents: [
    { name: 'chatbot', type: 'chatbot-agent' },
    { name: 'fraud-detection', type: 'fraud-detection-agent' }
  ],
  scenarios: [
    {
      type: 'message_exchange',
      config: {
        fromAgent: 'chatbot',
        toAgent: 'fraud-detection',
        messageCount: 10,
        interval: 1000
      }
    }
  ],
  duration: 30000
});

await framework.cleanup();
```

## Test Configuration

### Framework Configuration

```typescript
interface FrameworkConfig {
  reportDirectory: string;      // Directory for test reports
  mockServices: boolean;        // Enable/disable mock services
  parallelExecution: boolean;   // Run tests in parallel
  maxRetries: number;          // Maximum test retries
  timeout: number;             // Test timeout in milliseconds
  cleanupAfterTests: boolean;  // Cleanup resources after tests
  generateReports: boolean;    // Generate test reports
}
```

### Test Data Configuration

```typescript
interface TestDataSetConfig {
  customerCount: number;        // Number of test customers
  transactionHistory: boolean;  // Generate transaction history
  orderHistory: boolean;        // Generate order history
  fraudPatterns: boolean;       // Include fraud patterns
  seasonalData: boolean;        // Include seasonal patterns
  ttl: number;                 // Time to live for test data
}
```

## Mock Services

### Configuring Mock Responses

```typescript
// Configure specific responses for testing
await framework.getMockServices().configureMockResponse(
  'gemini',
  'fraud_analysis',
  {
    riskScore: 0.95,
    riskLevel: 'HIGH',
    recommendation: 'BLOCK_TRANSACTION'
  }
);

// Simulate service delays
await framework.getMockServices().simulateServiceDelay('mcp', 2000);

// Simulate service errors
await framework.getMockServices().simulateServiceError('external-apis', 500, 'Internal Server Error');
```

### Mock Service Endpoints

#### Mock MCP Service (Port 9001)

- `GET /users/:id` - Get user information
- `GET /users/:id/transactions` - Get user transactions
- `GET /users/:id/orders` - Get user orders
- `GET /users/:id/account` - Get account information
- `GET /products` - Get product catalog
- `GET /products/:id` - Get specific product

#### Mock External APIs (Port 9002)

- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `GET /api/transactions/:id` - Get transaction
- `POST /api/transactions` - Create transaction
- `GET /api/products` - Get products
- `GET /api/orders/:id` - Get order

#### Mock Gemini Service (Port 9003)

- `POST /v1/models/:model:generateContent` - Generate AI content
- `GET /v1/models` - List available models
- `GET /v1/models/:model` - Get model information

#### Mock Redis Service (Port 9004)

- `POST /redis/:command` - Execute Redis command
- `GET /redis/keys/:pattern` - Get keys by pattern
- `GET /redis/get/:key` - Get value by key
- `POST /redis/set` - Set key-value pair

## Test Data Generation

### Customer Data

```typescript
const dataManager = framework.getDataManager();

// Create test customers
const customers = await dataManager.createTestDataSet({
  customerCount: 100,
  transactionHistory: true,
  fraudPatterns: true
});

// Create specific test scenarios
const fraudData = await dataManager.createFraudDetectionTestData();
const recommendationData = await dataManager.createRecommendationTestData();
```

### Synthetic Workloads

```typescript
// Generate synthetic workload for load testing
const workload = await dataManager.generateSyntheticWorkload('mixed', 100);

// Types: 'transaction_processing', 'chat_interactions', 'api_requests', 'mixed'
```

## Test Reporting

### Report Formats

The framework generates reports in multiple formats:

- **JSON**: Machine-readable format for CI/CD integration
- **HTML**: Human-readable format with visualizations
- **CSV**: Spreadsheet-compatible format for analysis

### Report Contents

- Test execution summary
- Individual test results
- Agent communication metrics
- Performance metrics
- Error details and stack traces
- System resource usage

### Accessing Reports

```typescript
// Generate specific report format
const reportPath = await framework.getReporter().generateReport('html');

// Get test summary
const summary = framework.getReporter().getReportSummary();

// Generate CI-friendly report
const ciReport = await framework.generateCIReport();
```

## CI/CD Integration

### GitHub Actions

The framework includes a comprehensive GitHub Actions workflow (`ci-pipeline.yml`) that:

- Runs tests in parallel across multiple suites
- Collects test artifacts and logs
- Performs performance analysis
- Generates summary reports
- Notifies team on failures

### Environment Variables

```bash
NODE_ENV=test                    # Test environment
TEST_BASE_URL=http://localhost   # Base URL for services
REDIS_URL=redis://localhost:6379 # Redis connection
TEST_TIMEOUT=300000              # Test timeout (5 minutes)
```

### CI Metrics Export

```typescript
const metrics = await framework.exportMetricsForCI();
// Returns: test_success_rate, average_latency, throughput, etc.
```

## Performance Testing

### Load Test Configuration

```typescript
const loadTestConfig = {
  testName: 'System Load Test',
  workloadType: 'mixed',
  intensity: 100,              // Requests per second
  concurrentSessions: 10,      // Parallel test sessions
  duration: 60000,             // Test duration in ms
  scaleServices: true          // Auto-scale services
};

const results = await framework.runLoadTest(loadTestConfig);
```

### Performance Thresholds

- **Latency**: < 2000ms average response time
- **Error Rate**: < 5% failed requests
- **Throughput**: > 50 requests per second
- **Recovery Time**: < 60 seconds for failure recovery

## Failure Testing

### Simulated Failures

```typescript
const failureTestConfig = {
  testName: 'Agent Failure Recovery',
  failures: [
    {
      type: 'agent_failure',
      target: 'fraud-detection',
      duration: 30000
    },
    {
      type: 'network_partition',
      target: 'chatbot',
      duration: 20000
    }
  ],
  maxRecoveryTime: 60000
};

const results = await framework.runFailureRecoveryTest(failureTestConfig);
```

### Failure Types

- **Agent Failure**: Simulate agent crashes or unresponsiveness
- **Network Partition**: Simulate network connectivity issues
- **Service Failure**: Simulate external service outages

## Best Practices

### Test Organization

1. **Group Related Tests**: Use test suites to organize related functionality
2. **Isolation**: Ensure tests don't interfere with each other
3. **Cleanup**: Always clean up test data and resources
4. **Deterministic**: Make tests predictable and repeatable

### Performance Considerations

1. **Parallel Execution**: Use parallel execution for independent tests
2. **Resource Management**: Monitor memory and CPU usage during tests
3. **Service Scaling**: Scale services appropriately for load tests
4. **Cleanup Timing**: Schedule cleanup to avoid resource leaks

### Debugging

1. **Verbose Logging**: Enable detailed logging for troubleshooting
2. **Artifact Collection**: Collect logs and metrics for failed tests
3. **Mock Configuration**: Use mock services to isolate issues
4. **Step-by-Step**: Break complex tests into smaller steps

## Troubleshooting

### Common Issues

#### Services Not Ready

```bash
# Check service health
curl http://localhost:8080/health
curl http://localhost:8081/health

# Check Docker containers
docker-compose -f docker/docker-compose.yml ps
```

#### Test Timeouts

```bash
# Increase timeout in jest.config.js
module.exports = {
  testTimeout: 300000  // 5 minutes
};
```

#### Memory Issues

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### Mock Service Issues

```bash
# Reset mock services
await framework.getMockServices().resetMockService('serviceName');

# Check mock service logs
npm run docker:compose:logs mock-services
```

### Debug Mode

```bash
# Run with debug logging
DEBUG=integration-test:* npm run test:integration:all

# Run specific test with verbose output
npm run test:integration -- --verbose --testNamePattern="Agent Communication"
```

## Contributing

### Adding New Tests

1. Create test functions following the existing patterns
2. Add tests to appropriate test suites
3. Update documentation and examples
4. Ensure proper cleanup and error handling

### Extending Mock Services

1. Add new endpoints to existing mock services
2. Create new mock services for additional dependencies
3. Update mock service manager configuration
4. Add tests for new mock functionality

### Performance Optimization

1. Profile test execution to identify bottlenecks
2. Optimize test data generation for large datasets
3. Implement caching for frequently used test data
4. Use connection pooling for database operations

## Architecture

```
tests/integration/
├── integration-test-framework.ts    # Main framework class
├── test-harness.ts                  # Agent communication testing
├── test-data-manager.ts             # Test data generation/cleanup
├── test-reporter.ts                 # Report generation
├── example-tests.ts                 # Example test implementations
├── run-integration-tests.ts         # Test runner script
├── ci-pipeline.yml                  # CI/CD configuration
├── mock-services/                   # Mock service implementations
│   ├── mock-service-manager.ts
│   ├── mock-mcp-service.ts
│   ├── mock-external-apis.ts
│   ├── mock-gemini-service.ts
│   └── mock-redis-service.ts
└── utils/
    ├── test-environment.ts          # Environment management
    └── test-data-generator.ts       # Data generation utilities
```

This integration test framework provides comprehensive testing capabilities for the agentic microservices system, ensuring reliability, performance, and maintainability of the AI-enhanced application.
