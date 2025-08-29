/**
 * Unit tests for Metrics Collection System
 */

import { MetricsCollector, MetricDefinition, AlertRule } from '../metrics';

// Mock prom-client
jest.mock('prom-client', () => ({
  register: {
    metrics: jest.fn().mockResolvedValue('# Prometheus metrics'),
    clear: jest.fn()
  },
  collectDefaultMetrics: jest.fn(),
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn()
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    observe: jest.fn()
  })),
  Summary: jest.fn().mockImplementation(() => ({
    observe: jest.fn()
  }))
}));

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    jest.clearAllMocks();
  });

  afterEach(() => {
    collector.stopCollection();
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default health checks', () => {
      expect(collector['healthChecks'].size).toBeGreaterThan(0);
      expect(collector['healthChecks'].has('memory_usage')).toBe(true);
      expect(collector['healthChecks'].has('agent_connectivity')).toBe(true);
      expect(collector['healthChecks'].has('error_rate')).toBe(true);
    });

    it('should initialize Prometheus metrics', () => {
      expect(collector['requestsTotal']).toBeDefined();
      expect(collector['requestDuration']).toBeDefined();
      expect(collector['activeConnections']).toBeDefined();
      expect(collector['agentUptime']).toBeDefined();
    });
  });

  describe('agent registration', () => {
    it('should register agent successfully', () => {
      const agentRegisteredSpy = jest.fn();
      collector.on('agentRegistered', agentRegisteredSpy);

      collector.registerAgent('agent-1', 'chatbot');

      expect(collector['agentMetrics'].has('agent-1')).toBe(true);
      expect(agentRegisteredSpy).toHaveBeenCalledWith({
        agentId: 'agent-1',
        agentType: 'chatbot'
      });

      const metrics = collector['agentMetrics'].get('agent-1');
      expect(metrics?.agentId).toBe('agent-1');
      expect(metrics?.agentType).toBe('chatbot');
      expect(metrics?.requestsTotal).toBe(0);
    });

    it('should unregister agent successfully', () => {
      const agentUnregisteredSpy = jest.fn();
      collector.on('agentUnregistered', agentUnregisteredSpy);

      collector.registerAgent('agent-1', 'chatbot');
      collector.unregisterAgent('agent-1');

      expect(collector['agentMetrics'].has('agent-1')).toBe(false);
      expect(agentUnregisteredSpy).toHaveBeenCalledWith({
        agentId: 'agent-1'
      });
    });
  });

  describe('metrics collection', () => {
    beforeEach(() => {
      collector.registerAgent('agent-1', 'chatbot');
      collector.registerAgent('agent-2', 'fraud-detection');
    });

    it('should start and stop collection', () => {
      const startedSpy = jest.fn();
      const stoppedSpy = jest.fn();
      
      collector.on('collectionStarted', startedSpy);
      collector.on('collectionStopped', stoppedSpy);

      collector.startCollection(1000);
      expect(collector['isCollecting']).toBe(true);
      expect(startedSpy).toHaveBeenCalled();

      collector.stopCollection();
      expect(collector['isCollecting']).toBe(false);
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should record request metrics', () => {
      const requestRecordedSpy = jest.fn();
      collector.on('requestRecorded', requestRecordedSpy);

      collector.recordRequest('agent-1', 'chatbot', 'POST', 'success', 150);

      const metrics = collector['agentMetrics'].get('agent-1');
      expect(metrics?.requestsTotal).toBe(1);
      expect(metrics?.requestsSuccessful).toBe(1);
      expect(metrics?.requestsFailed).toBe(0);
      expect(metrics?.averageResponseTime).toBe(150);
      expect(metrics?.errorRate).toBe(0);

      expect(requestRecordedSpy).toHaveBeenCalledWith({
        agentId: 'agent-1',
        agentType: 'chatbot',
        method: 'POST',
        status: 'success',
        duration: 150
      });
    });

    it('should record failed requests', () => {
      collector.recordRequest('agent-1', 'chatbot', 'POST', 'error', 200);

      const metrics = collector['agentMetrics'].get('agent-1');
      expect(metrics?.requestsTotal).toBe(1);
      expect(metrics?.requestsSuccessful).toBe(0);
      expect(metrics?.requestsFailed).toBe(1);
      expect(metrics?.errorRate).toBe(1);
    });

    it('should update agent metrics', () => {
      const metricsUpdatedSpy = jest.fn();
      collector.on('agentMetricsUpdated', metricsUpdatedSpy);

      const updates = {
        currentConnections: 5,
        memoryUsage: 1024 * 1024 * 100, // 100MB
        cpuUsage: 25.5
      };

      collector.updateAgentMetrics('agent-1', updates);

      const metrics = collector['agentMetrics'].get('agent-1');
      expect(metrics?.currentConnections).toBe(5);
      expect(metrics?.memoryUsage).toBe(1024 * 1024 * 100);
      expect(metrics?.cpuUsage).toBe(25.5);

      expect(metricsUpdatedSpy).toHaveBeenCalledWith({
        agentId: 'agent-1',
        updates
      });
    });

    it('should get agent metrics', () => {
      collector.updateAgentMetrics('agent-1', { requestsTotal: 10 });

      const singleMetrics = collector.getAgentMetrics('agent-1');
      expect(singleMetrics).toBeDefined();
      expect((singleMetrics as any).agentId).toBe('agent-1');

      const allMetrics = collector.getAgentMetrics();
      expect(Array.isArray(allMetrics)).toBe(true);
      expect((allMetrics as any[]).length).toBe(2);
    });

    it('should throw error for non-existent agent', () => {
      expect(() => {
        collector.getAgentMetrics('non-existent');
      }).toThrow('Agent metrics not found: non-existent');
    });

    it('should get system metrics', () => {
      collector.updateAgentMetrics('agent-1', { 
        requestsTotal: 100, 
        memoryUsage: 1024 * 1024 * 50,
        cpuUsage: 30,
        uptime: 60000
      });
      collector.updateAgentMetrics('agent-2', { 
        requestsTotal: 200, 
        memoryUsage: 1024 * 1024 * 75,
        cpuUsage: 45,
        uptime: 120000
      });

      const systemMetrics = collector.getSystemMetrics();

      expect(systemMetrics.totalAgents).toBe(2);
      expect(systemMetrics.activeAgents).toBe(2);
      expect(systemMetrics.totalRequests).toBe(300);
      expect(systemMetrics.memoryUsageTotal).toBe(1024 * 1024 * 125);
      expect(systemMetrics.cpuUsageTotal).toBe(37.5); // Average
    });
  });

  describe('custom metrics', () => {
    it('should create custom counter metric', () => {
      const metricCreatedSpy = jest.fn();
      collector.on('customMetricCreated', metricCreatedSpy);

      const definition: MetricDefinition = {
        name: 'custom_counter',
        help: 'A custom counter metric',
        type: 'counter',
        labels: ['label1', 'label2']
      };

      collector.createCustomMetric(definition);

      expect(collector['customMetrics'].has('custom_counter')).toBe(true);
      expect(metricCreatedSpy).toHaveBeenCalledWith(definition);
    });

    it('should create custom gauge metric', () => {
      const definition: MetricDefinition = {
        name: 'custom_gauge',
        help: 'A custom gauge metric',
        type: 'gauge'
      };

      collector.createCustomMetric(definition);

      expect(collector['customMetrics'].has('custom_gauge')).toBe(true);
    });

    it('should create custom histogram metric', () => {
      const definition: MetricDefinition = {
        name: 'custom_histogram',
        help: 'A custom histogram metric',
        type: 'histogram',
        buckets: [0.1, 0.5, 1, 2, 5]
      };

      collector.createCustomMetric(definition);

      expect(collector['customMetrics'].has('custom_histogram')).toBe(true);
    });

    it('should create custom summary metric', () => {
      const definition: MetricDefinition = {
        name: 'custom_summary',
        help: 'A custom summary metric',
        type: 'summary',
        percentiles: [0.5, 0.9, 0.99]
      };

      collector.createCustomMetric(definition);

      expect(collector['customMetrics'].has('custom_summary')).toBe(true);
    });

    it('should throw error for unsupported metric type', () => {
      const definition = {
        name: 'invalid_metric',
        help: 'Invalid metric',
        type: 'invalid' as any
      };

      expect(() => {
        collector.createCustomMetric(definition);
      }).toThrow('Unsupported metric type: invalid');
    });

    it('should update custom metrics', () => {
      const metricUpdatedSpy = jest.fn();
      collector.on('customMetricUpdated', metricUpdatedSpy);

      // Create a gauge metric
      collector.createCustomMetric({
        name: 'test_gauge',
        help: 'Test gauge',
        type: 'gauge'
      });

      collector.updateCustomMetric('test_gauge', 42, { label: 'value' }, 'set');

      expect(metricUpdatedSpy).toHaveBeenCalledWith({
        name: 'test_gauge',
        value: 42,
        labels: { label: 'value' },
        operation: 'set'
      });
    });

    it('should throw error for non-existent custom metric', () => {
      expect(() => {
        collector.updateCustomMetric('non_existent', 42);
      }).toThrow('Custom metric not found: non_existent');
    });
  });

  describe('health checks', () => {
    it('should register custom health check', () => {
      const healthCheckRegisteredSpy = jest.fn();
      collector.on('healthCheckRegistered', healthCheckRegisteredSpy);

      const customCheck = async () => ({
        name: 'custom_check',
        status: 'pass' as const,
        message: 'All good',
        duration: 10
      });

      collector.registerHealthCheck('custom_check', customCheck);

      expect(collector['healthChecks'].has('custom_check')).toBe(true);
      expect(healthCheckRegisteredSpy).toHaveBeenCalledWith({
        name: 'custom_check'
      });
    });

    it('should unregister health check', () => {
      const healthCheckUnregisteredSpy = jest.fn();
      collector.on('healthCheckUnregistered', healthCheckUnregisteredSpy);

      const customCheck = async () => ({
        name: 'custom_check',
        status: 'pass' as const,
        message: 'All good',
        duration: 10
      });

      collector.registerHealthCheck('custom_check', customCheck);
      collector.unregisterHealthCheck('custom_check');

      expect(collector['healthChecks'].has('custom_check')).toBe(false);
      expect(healthCheckUnregisteredSpy).toHaveBeenCalledWith({
        name: 'custom_check'
      });
    });

    it('should run all health checks successfully', async () => {
      const healthCheckCompletedSpy = jest.fn();
      collector.on('healthCheckCompleted', healthCheckCompletedSpy);

      // Register agents to make connectivity check pass
      collector.registerAgent('agent-1', 'chatbot');
      collector.updateAgentMetrics('agent-1', { uptime: 60000 });

      const result = await collector.runHealthChecks();

      expect(result.status).toBeDefined();
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThanOrEqual(0);

      expect(healthCheckCompletedSpy).toHaveBeenCalledWith(result);
    });

    it('should handle health check failures', async () => {
      const failingCheck = async () => {
        throw new Error('Health check failed');
      };

      collector.registerHealthCheck('failing_check', failingCheck);

      const result = await collector.runHealthChecks();

      const failedCheck = result.checks.find(c => c.name === 'failing_check');
      expect(failedCheck?.status).toBe('fail');
      expect(failedCheck?.message).toContain('Health check failed');
    });

    it('should determine overall status correctly', async () => {
      // Unregister default health checks to isolate test
      collector['healthChecks'].clear();

      // Register checks with different statuses
      collector.registerHealthCheck('pass_check', async () => ({
        name: 'pass_check',
        status: 'pass',
        message: 'OK',
        duration: 5
      }));

      collector.registerHealthCheck('warn_check', async () => ({
        name: 'warn_check',
        status: 'warn',
        message: 'Warning',
        duration: 5
      }));

      const result = await collector.runHealthChecks();

      // Should be degraded due to warning
      expect(result.status).toBe('degraded');
    });
  });

  describe('alert rules', () => {
    it('should add alert rule', () => {
      const alertRuleAddedSpy = jest.fn();
      collector.on('alertRuleAdded', alertRuleAddedSpy);

      const rule: AlertRule = {
        name: 'HighErrorRate',
        description: 'High error rate detected',
        condition: 'agent_error_rate > 0.1',
        severity: 'critical',
        duration: '5m',
        labels: { team: 'platform' },
        annotations: { runbook: 'https://example.com/runbook' }
      };

      collector.addAlertRule(rule);

      expect(collector.getAlertRules()).toContain(rule);
      expect(alertRuleAddedSpy).toHaveBeenCalledWith(rule);
    });

    it('should remove alert rule', () => {
      const alertRuleRemovedSpy = jest.fn();
      collector.on('alertRuleRemoved', alertRuleRemovedSpy);

      const rule: AlertRule = {
        name: 'TestRule',
        description: 'Test rule',
        condition: 'test_metric > 1',
        severity: 'warning',
        duration: '1m'
      };

      collector.addAlertRule(rule);
      collector.removeAlertRule('TestRule');

      expect(collector.getAlertRules()).not.toContain(rule);
      expect(alertRuleRemovedSpy).toHaveBeenCalledWith(rule);
    });

    it('should generate Prometheus alert rules', () => {
      const rule: AlertRule = {
        name: 'HighMemoryUsage',
        description: 'High memory usage detected',
        condition: 'agent_memory_usage_bytes > 1000000000',
        severity: 'warning',
        duration: '2m',
        labels: { component: 'agent' },
        annotations: { summary: 'Memory usage is high' }
      };

      collector.addAlertRule(rule);

      const alertRules = collector.generatePrometheusAlertRules();

      expect(alertRules).toContain('groups:');
      expect(alertRules).toContain('- name: agent-alerts');
      expect(alertRules).toContain('alert: HighMemoryUsage');
      expect(alertRules).toContain('expr: agent_memory_usage_bytes > 1000000000');
      expect(alertRules).toContain('for: 2m');
      expect(alertRules).toContain('severity: warning');
    });
  });

  describe('Prometheus integration', () => {
    it('should get Prometheus metrics', async () => {
      const metrics = await collector.getPrometheusMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics).toBe('# Prometheus metrics');
    });
  });

  describe('error handling', () => {
    it('should handle metrics collection errors', async () => {
      const metricsCollectionErrorSpy = jest.fn();
      collector.on('metricsCollectionError', metricsCollectionErrorSpy);

      // Mock error in collectMetrics - need to bind it properly
      const originalCollectMetrics = collector['collectMetrics'].bind(collector);
      collector['collectMetrics'] = jest.fn().mockImplementation(async () => {
        throw new Error('Collection failed');
      });

      collector.startCollection(100);

      // Wait for collection to run and error to be emitted
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(metricsCollectionErrorSpy).toHaveBeenCalled();

      // Restore original method
      collector['collectMetrics'] = originalCollectMetrics;
    });
  });
});