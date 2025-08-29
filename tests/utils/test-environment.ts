import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TestEnvironment {
  private baseUrl: string;
  private services: Map<string, ServiceConfig>;
  private isSetup: boolean = false;

  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost';
    this.services = new Map([
      ['chatbot-agent', { port: 8082, healthPath: '/health' }],
      ['fraud-detection-agent', { port: 8084, healthPath: '/health' }],
      ['recommendation-agent', { port: 8085, healthPath: '/health' }],
      ['mcp-gateway', { port: 8080, healthPath: '/health' }],
      ['a2a-hub', { port: 8081, healthPath: '/health' }],
      ['adk', { port: 8086, healthPath: '/health' }],
      ['redis', { port: 6379, healthPath: null }]
    ]);
  }

  async setup(): Promise<void> {
    if (this.isSetup) return;

    console.log('Setting up test environment...');
    
    // Start services if not already running
    await this.startAllServices();
    
    // Initialize test database
    await this.initializeTestDatabase();
    
    // Setup test data storage
    await this.setupTestDataStorage();
    
    this.isSetup = true;
    console.log('Test environment setup complete');
  }

  async cleanup(): Promise<void> {
    if (!this.isSetup) return;

    console.log('Cleaning up test environment...');
    
    // Clean test data
    await this.cleanTestData();
    
    // Reset services to initial state
    await this.resetServices();
    
    this.isSetup = false;
    console.log('Test environment cleanup complete');
  }

  async waitForServicesReady(timeout: number = 60000): Promise<void> {
    const startTime = Date.now();
    const services = Array.from(this.services.keys());
    
    while (Date.now() - startTime < timeout) {
      const healthChecks = await Promise.allSettled(
        services.map(service => this.checkServiceHealth(service))
      );
      
      const healthyServices = healthChecks.filter(check => check.status === 'fulfilled').length;
      
      if (healthyServices === services.length) {
        console.log('All services are ready');
        return;
      }
      
      console.log(`Waiting for services... ${healthyServices}/${services.length} ready`);
      await this.wait(2000);
    }
    
    throw new Error('Services did not become ready within timeout');
  }

  async checkServiceHealth(serviceName: string): Promise<boolean> {
    const config = this.services.get(serviceName);
    if (!config) throw new Error(`Unknown service: ${serviceName}`);
    
    if (!config.healthPath) {
      // For services like Redis, check if port is open
      return this.checkPortOpen(config.port);
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}:${config.port}${config.healthPath}`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async startService(serviceName: string): Promise<void> {
    console.log(`Starting service: ${serviceName}`);
    
    if (process.env.NODE_ENV === 'docker') {
      await execAsync(`docker-compose -f docker/docker-compose.yml start ${serviceName}`);
    } else {
      // For local development, services should be started manually
      console.log(`Please ensure ${serviceName} is running locally`);
    }
  }

  async stopService(serviceName: string): Promise<void> {
    console.log(`Stopping service: ${serviceName}`);
    
    if (process.env.NODE_ENV === 'docker') {
      await execAsync(`docker-compose -f docker/docker-compose.yml stop ${serviceName}`);
    } else {
      // For local development, simulate service unavailability
      await this.simulateServiceUnavailability(serviceName);
    }
  }

  async waitForServiceReady(serviceName: string, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await this.checkServiceHealth(serviceName)) {
        return;
      }
      await this.wait(1000);
    }
    
    throw new Error(`Service ${serviceName} did not become ready within timeout`);
  }

  async getMCPGatewayLogs(): Promise<string[]> {
    try {
      if (process.env.NODE_ENV === 'docker') {
        const { stdout } = await execAsync('docker-compose -f docker/docker-compose.yml logs mcp-gateway');
        return stdout.split('\n').filter(line => line.trim());
      } else {
        // For local development, return mock logs
        return this.getMockLogs('mcp-gateway');
      }
    } catch (error) {
      console.warn('Could not retrieve MCP Gateway logs:', error);
      return [];
    }
  }

  async getA2AMessages(channel?: string): Promise<A2AMessage[]> {
    try {
      const response = await axios.get(`${this.baseUrl}:8081/api/messages${channel ? `?channel=${channel}` : ''}`, {
        timeout: 5000
      });
      return response.data.messages || [];
    } catch (error) {
      console.warn('Could not retrieve A2A messages:', error);
      return [];
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const response = await axios.get(`${this.baseUrl}:9090/metrics`, {
        timeout: 5000
      });
      
      // Parse Prometheus metrics
      return this.parsePrometheusMetrics(response.data);
    } catch (error) {
      console.warn('Could not retrieve system metrics:', error);
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        networkUtilization: 0,
        services: { total: 0, healthy: 0, unhealthy: 0, responding: 0 }
      };
    }
  }

  async getNotifications(recipient: string): Promise<Notification[]> {
    try {
      const response = await axios.get(`${this.baseUrl}:8080/api/notifications/${recipient}`, {
        timeout: 5000
      });
      return response.data.notifications || [];
    } catch (error) {
      console.warn('Could not retrieve notifications:', error);
      return [];
    }
  }

  async getAccountStatus(customerId: string): Promise<AccountStatus> {
    try {
      const response = await axios.get(`${this.baseUrl}:8080/api/accounts/${customerId}/status`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.warn('Could not retrieve account status:', error);
      return { flagged: false, reason: null };
    }
  }

  async getCustomerNotifications(customerId: string): Promise<CustomerNotification[]> {
    try {
      const response = await axios.get(`${this.baseUrl}:8080/api/customers/${customerId}/notifications`, {
        timeout: 5000
      });
      return response.data.notifications || [];
    } catch (error) {
      console.warn('Could not retrieve customer notifications:', error);
      return [];
    }
  }

  async simulateNetworkIssues(serviceName: string): Promise<void> {
    console.log(`Simulating network issues for ${serviceName}`);
    // Implementation would depend on testing infrastructure
    // Could use tools like Chaos Monkey, tc (traffic control), or service mesh features
  }

  async restoreNetworkConnectivity(serviceName: string): Promise<void> {
    console.log(`Restoring network connectivity for ${serviceName}`);
    // Restore normal network conditions
  }

  async simulateServiceFailure(serviceName: string): Promise<void> {
    console.log(`Simulating failure for ${serviceName}`);
    await this.stopService(serviceName);
  }

  async restoreService(serviceName: string): Promise<void> {
    console.log(`Restoring service ${serviceName}`);
    await this.startService(serviceName);
    await this.waitForServiceReady(serviceName);
  }

  async scaleForLoadTesting(): Promise<void> {
    console.log('Scaling services for load testing...');
    
    if (process.env.NODE_ENV === 'kubernetes') {
      // Scale up deployments for load testing
      const scaleCommands = [
        'kubectl scale deployment chatbot-agent --replicas=3 -n ai-agents',
        'kubectl scale deployment fraud-detection-agent --replicas=5 -n ai-agents',
        'kubectl scale deployment recommendation-agent --replicas=3 -n ai-agents',
        'kubectl scale deployment mcp-gateway --replicas=3 -n integration',
        'kubectl scale deployment a2a-hub --replicas=3 -n integration'
      ];
      
      for (const command of scaleCommands) {
        await execAsync(command);
      }
      
      // Wait for pods to be ready
      await this.wait(30000);
    }
  }

  async scaleDown(): Promise<void> {
    console.log('Scaling services back down...');
    
    if (process.env.NODE_ENV === 'kubernetes') {
      const scaleCommands = [
        'kubectl scale deployment chatbot-agent --replicas=1 -n ai-agents',
        'kubectl scale deployment fraud-detection-agent --replicas=1 -n ai-agents',
        'kubectl scale deployment recommendation-agent --replicas=1 -n ai-agents',
        'kubectl scale deployment mcp-gateway --replicas=1 -n integration',
        'kubectl scale deployment a2a-hub --replicas=1 -n integration'
      ];
      
      for (const command of scaleCommands) {
        await execAsync(command);
      }
    }
  }

  async getWebSocketMetrics(): Promise<WebSocketMetrics> {
    try {
      const response = await axios.get(`${this.baseUrl}:8082/api/websocket/metrics`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      return {
        activeConnections: 0,
        connectionErrors: 0,
        messagesPerSecond: 0,
        averageLatency: 0
      };
    }
  }

  async getCurrentScale(): Promise<ScaleInfo> {
    if (process.env.NODE_ENV === 'kubernetes') {
      try {
        const { stdout } = await execAsync('kubectl get deployments --all-namespaces -o json');
        const deployments = JSON.parse(stdout);
        
        let totalReplicas = 0;
        const services: Record<string, number> = {};
        
        deployments.items.forEach((deployment: any) => {
          const name = deployment.metadata.name;
          const replicas = deployment.status.replicas || 0;
          services[name] = replicas;
          totalReplicas += replicas;
        });
        
        return { totalReplicas, services };
      } catch (error) {
        console.warn('Could not get current scale:', error);
      }
    }
    
    return { totalReplicas: 6, services: {} }; // Default for local testing
  }

  async getScalingEvents(): Promise<ScalingEvent[]> {
    if (process.env.NODE_ENV === 'kubernetes') {
      try {
        const { stdout } = await execAsync('kubectl get events --field-selector reason=ScalingReplicaSet -o json');
        const events = JSON.parse(stdout);
        
        return events.items.map((event: any) => ({
          timestamp: event.firstTimestamp,
          reason: event.reason,
          message: event.message,
          metricValue: this.extractMetricFromMessage(event.message),
          threshold: this.extractThresholdFromMessage(event.message)
        }));
      } catch (error) {
        console.warn('Could not get scaling events:', error);
      }
    }
    
    return [];
  }

  private async startAllServices(): Promise<void> {
    if (process.env.NODE_ENV === 'docker') {
      await execAsync('docker-compose -f docker/docker-compose.yml up -d');
    }
  }

  private async initializeTestDatabase(): Promise<void> {
    // Initialize test database with schema and seed data
    console.log('Initializing test database...');
  }

  private async setupTestDataStorage(): Promise<void> {
    // Setup temporary storage for test data
    console.log('Setting up test data storage...');
  }

  private async cleanTestData(): Promise<void> {
    // Clean up test data
    console.log('Cleaning test data...');
  }

  private async resetServices(): Promise<void> {
    // Reset services to initial state
    console.log('Resetting services...');
  }

  private async checkPortOpen(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`netstat -an | grep :${port}`);
      return stdout.includes(`LISTEN`);
    } catch (error) {
      return false;
    }
  }

  private async simulateServiceUnavailability(serviceName: string): Promise<void> {
    // For local testing, could use network rules or proxy to simulate unavailability
    console.log(`Simulating unavailability for ${serviceName}`);
  }

  private getMockLogs(serviceName: string): string[] {
    // Return mock logs for local testing
    return [
      `[INFO] ${serviceName} started`,
      `[INFO] Processing request`,
      `[INFO] Request completed successfully`
    ];
  }

  private parsePrometheusMetrics(metricsText: string): SystemMetrics {
    // Parse Prometheus metrics format
    const lines = metricsText.split('\n');
    const metrics: SystemMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      networkUtilization: 0,
      services: { total: 0, healthy: 0, unhealthy: 0, responding: 0 }
    };
    
    // Simple parsing - in real implementation would use proper Prometheus parser
    lines.forEach(line => {
      if (line.includes('cpu_usage')) {
        const match = line.match(/(\d+\.?\d*)/);
        if (match) metrics.cpuUsage = parseFloat(match[1]);
      }
      if (line.includes('memory_usage')) {
        const match = line.match(/(\d+\.?\d*)/);
        if (match) metrics.memoryUsage = parseFloat(match[1]);
      }
    });
    
    return metrics;
  }

  private extractMetricFromMessage(message: string): number {
    const match = message.match(/(\d+\.?\d*)%/);
    return match ? parseFloat(match[1]) : 0;
  }

  private extractThresholdFromMessage(message: string): number {
    const match = message.match(/threshold (\d+\.?\d*)%/);
    return match ? parseFloat(match[1]) : 0;
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface ServiceConfig {
  port: number;
  healthPath: string | null;
}

interface A2AMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: any;
  timestamp: string;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkUtilization: number;
  services: {
    total: number;
    healthy: number;
    unhealthy: number;
    responding: number;
  };
}

interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  severity: string;
}

interface AccountStatus {
  flagged: boolean;
  reason: string | null;
}

interface CustomerNotification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface WebSocketMetrics {
  activeConnections: number;
  connectionErrors: number;
  messagesPerSecond: number;
  averageLatency: number;
}

interface ScaleInfo {
  totalReplicas: number;
  services: Record<string, number>;
}

interface ScalingEvent {
  timestamp: string;
  reason: string;
  message: string;
  metricValue: number;
  threshold: number;
}