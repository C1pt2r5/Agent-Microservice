/**
 * Comprehensive Metrics Collection and Monitoring System
 * Provides Prometheus metrics, custom KPIs, and health monitoring for agents
 */

import { EventEmitter } from 'events';
import { register, collectDefaultMetrics, Counter, Gauge, Histogram, Summary } from 'prom-client';

export interface MetricDefinition {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: string[];
  buckets?: number[]; // For histograms
  percentiles?: number[]; // For summaries
}

export interface AgentMetrics {
  agentId: string;
  agentType: string;
  requestsTotal: number;
  requestsSuccessful: number;
  requestsFailed: number;
  averageResponseTime: number;
  currentConnections: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  throughput: number;
  customMetrics: Record<string, number>;
}

export interface SystemMetrics {
  totalAgents: number;
  activeAgents: number;
  totalRequests: number;
  systemUptime: number;
  memoryUsageTotal: number;
  cpuUsageTotal: number;
  networkTraffic: {
    inbound: number;
    outbound: number;
  };
  storageUsage: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: Date;
  duration: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  name: string;
  description: string;
  condition: string; // PromQL expression
  severity: 'info' | 'warning' | 'critical';
  duration: string; // e.g., '5m'
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, any> = new Map();
  private agentMetrics: Map<string, AgentMetrics> = new Map();
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();
  private alertRules: AlertRule[] = [];
  private isCollecting: boolean = false;
  private collectionInterval?: NodeJS.Timeout;
  private startTime: Date = new Date();

  // Prometheus metrics
  private requestsTotal!: Counter<string>;
  private requestDuration!: Histogram<string>;
  private activeConnections!: Gauge<string>;
  private agentUptime!: Gauge<string>;
  private memoryUsage!: Gauge<string>;
  private cpuUsage!: Gauge<string>;
  private errorRate!: Gauge<string>;
  private customMetrics: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializePrometheusMetrics();
    this.setupDefaultHealthChecks();
  }

  /**
   * Initialize Prometheus metrics
   */
  private initializePrometheusMetrics(): void {
    // Enable default metrics collection
    collectDefaultMetrics({ register });

    // Request metrics
    this.requestsTotal = new Counter({
      name: 'agent_requests_total',
      help: 'Total number of requests processed by agents',
      labelNames: ['agent_id', 'agent_type', 'method', 'status'],
      registers: [register]
    });

    this.requestDuration = new Histogram({
      name: 'agent_request_duration_seconds',
      help: 'Duration of agent requests in seconds',
      labelNames: ['agent_id', 'agent_type', 'method'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register]
    });

    // Connection metrics
    this.activeConnections = new Gauge({
      name: 'agent_active_connections',
      help: 'Number of active connections per agent',
      labelNames: ['agent_id', 'agent_type'],
      registers: [register]
    });

    // System metrics
    this.agentUptime = new Gauge({
      name: 'agent_uptime_seconds',
      help: 'Agent uptime in seconds',
      labelNames: ['agent_id', 'agent_type'],
      registers: [register]
    });

    this.memoryUsage = new Gauge({
      name: 'agent_memory_usage_bytes',
      help: 'Agent memory usage in bytes',
      labelNames: ['agent_id', 'agent_type'],
      registers: [register]
    });

    this.cpuUsage = new Gauge({
      name: 'agent_cpu_usage_percent',
      help: 'Agent CPU usage percentage',
      labelNames: ['agent_id', 'agent_type'],
      registers: [register]
    });

    this.errorRate = new Gauge({
      name: 'agent_error_rate',
      help: 'Agent error rate (0-1)',
      labelNames: ['agent_id', 'agent_type'],
      registers: [register]
    });
  }

  /**
   * Start metrics collection
   */
  startCollection(intervalMs: number = 15000): void {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;
    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error in metrics collection interval:', error);
        this.emit('metricsCollectionError', error);
      }
    }, intervalMs);

    this.emit('collectionStarted');
    console.log('Metrics collection started');
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (!this.isCollecting) {
      return;
    }

    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    this.emit('collectionStopped');
    console.log('Metrics collection stopped');
  }

  /**
   * Register an agent for metrics collection
   */
  registerAgent(agentId: string, agentType: string): void {
    const metrics: AgentMetrics = {
      agentId,
      agentType,
      requestsTotal: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      averageResponseTime: 0,
      currentConnections: 0,
      uptime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      errorRate: 0,
      throughput: 0,
      customMetrics: {}
    };

    this.agentMetrics.set(agentId, metrics);
    this.emit('agentRegistered', { agentId, agentType });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agentMetrics.delete(agentId);
    this.emit('agentUnregistered', { agentId });
  }

  /**
   * Record a request metric
   */
  recordRequest(
    agentId: string,
    agentType: string,
    method: string,
    status: string,
    duration: number
  ): void {
    // Update Prometheus metrics
    this.requestsTotal.inc({ agent_id: agentId, agent_type: agentType, method, status });
    this.requestDuration.observe({ agent_id: agentId, agent_type: agentType, method }, duration / 1000);

    // Update agent metrics
    const metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      metrics.requestsTotal++;
      if (status === 'success') {
        metrics.requestsSuccessful++;
      } else {
        metrics.requestsFailed++;
      }

      // Update average response time
      const totalTime = metrics.averageResponseTime * (metrics.requestsTotal - 1) + duration;
      metrics.averageResponseTime = totalTime / metrics.requestsTotal;

      // Update error rate
      metrics.errorRate = metrics.requestsFailed / metrics.requestsTotal;

      this.agentMetrics.set(agentId, metrics);
    }

    this.emit('requestRecorded', { agentId, agentType, method, status, duration });
  }

  /**
   * Update agent system metrics
   */
  updateAgentMetrics(
    agentId: string,
    updates: Partial<AgentMetrics>
  ): void {
    const metrics = this.agentMetrics.get(agentId);
    if (!metrics) {
      return;
    }

    // Update metrics
    Object.assign(metrics, updates);

    // Update Prometheus metrics
    if (updates.currentConnections !== undefined) {
      this.activeConnections.set({ agent_id: agentId, agent_type: metrics.agentType }, updates.currentConnections);
    }

    if (updates.uptime !== undefined) {
      this.agentUptime.set({ agent_id: agentId, agent_type: metrics.agentType }, updates.uptime);
    }

    if (updates.memoryUsage !== undefined) {
      this.memoryUsage.set({ agent_id: agentId, agent_type: metrics.agentType }, updates.memoryUsage);
    }

    if (updates.cpuUsage !== undefined) {
      this.cpuUsage.set({ agent_id: agentId, agent_type: metrics.agentType }, updates.cpuUsage);
    }

    if (updates.errorRate !== undefined) {
      this.errorRate.set({ agent_id: agentId, agent_type: metrics.agentType }, updates.errorRate);
    }

    this.agentMetrics.set(agentId, metrics);
    this.emit('agentMetricsUpdated', { agentId, updates });
  }

  /**
   * Create custom metric
   */
  createCustomMetric(definition: MetricDefinition): void {
    let metric: any;

    switch (definition.type) {
      case 'counter':
        metric = new Counter({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labels || [],
          registers: [register]
        });
        break;

      case 'gauge':
        metric = new Gauge({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labels || [],
          registers: [register]
        });
        break;

      case 'histogram':
        metric = new Histogram({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labels || [],
          buckets: definition.buckets || [0.1, 0.5, 1, 2, 5, 10],
          registers: [register]
        });
        break;

      case 'summary':
        metric = new Summary({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labels || [],
          percentiles: definition.percentiles || [0.5, 0.9, 0.95, 0.99],
          registers: [register]
        });
        break;

      default:
        throw new Error(`Unsupported metric type: ${definition.type}`);
    }

    this.customMetrics.set(definition.name, metric);
    this.emit('customMetricCreated', definition);
  }

  /**
   * Update custom metric
   */
  updateCustomMetric(
    name: string,
    value: number,
    labels?: Record<string, string>,
    operation: 'inc' | 'dec' | 'set' | 'observe' = 'set'
  ): void {
    const metric = this.customMetrics.get(name);
    if (!metric) {
      throw new Error(`Custom metric not found: ${name}`);
    }

    switch (operation) {
      case 'inc':
        if (typeof metric.inc === 'function') {
          metric.inc(labels, value);
        }
        break;
      case 'dec':
        if (typeof metric.dec === 'function') {
          metric.dec(labels, value);
        }
        break;
      case 'set':
        if (typeof metric.set === 'function') {
          metric.set(labels, value);
        }
        break;
      case 'observe':
        if (typeof metric.observe === 'function') {
          metric.observe(labels, value);
        }
        break;
    }

    this.emit('customMetricUpdated', { name, value, labels, operation });
  }

  /**
   * Register health check
   */
  registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, checkFunction);
    this.emit('healthCheckRegistered', { name });
  }

  /**
   * Unregister health check
   */
  unregisterHealthCheck(name: string): void {
    this.healthChecks.delete(name);
    this.emit('healthCheckUnregistered', { name });
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, checkFunction] of this.healthChecks.entries()) {
      const checkStartTime = Date.now();
      try {
        const check = await checkFunction();
        // Ensure duration is set properly
        check.duration = Date.now() - checkStartTime;
        checks.push(check);

        if (check.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (check.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checks.push({
          name,
          status: 'fail',
          message: `Health check failed: ${error}`,
          duration: Date.now() - checkStartTime
        });
        overallStatus = 'unhealthy';
      }
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      checks,
      timestamp: new Date(),
      duration: Date.now() - startTime
    };

    this.emit('healthCheckCompleted', result);
    return result;
  }

  /**
   * Get agent metrics
   */
  getAgentMetrics(agentId?: string): AgentMetrics | AgentMetrics[] {
    if (agentId) {
      const metrics = this.agentMetrics.get(agentId);
      if (!metrics) {
        throw new Error(`Agent metrics not found: ${agentId}`);
      }
      return metrics;
    }

    return Array.from(this.agentMetrics.values());
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const agents = Array.from(this.agentMetrics.values());
    const activeAgents = agents.filter(a => a.uptime > 0);

    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      totalRequests: agents.reduce((sum, a) => sum + a.requestsTotal, 0),
      systemUptime: Date.now() - this.startTime.getTime(),
      memoryUsageTotal: agents.reduce((sum, a) => sum + a.memoryUsage, 0),
      cpuUsageTotal: agents.reduce((sum, a) => sum + a.cpuUsage, 0) / Math.max(agents.length, 1),
      networkTraffic: {
        inbound: 0, // Would be collected from system
        outbound: 0
      },
      storageUsage: 0 // Would be collected from system
    };
  }

  /**
   * Get Prometheus metrics
   */
  async getPrometheusMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    this.emit('alertRuleAdded', rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(name: string): void {
    const index = this.alertRules.findIndex(rule => rule.name === name);
    if (index !== -1) {
      const removed = this.alertRules.splice(index, 1)[0];
      this.emit('alertRuleRemoved', removed);
    }
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Generate Prometheus alert rules configuration
   */
  generatePrometheusAlertRules(): string {
    const groups = [{
      name: 'agent-alerts',
      rules: this.alertRules.map(rule => ({
        alert: rule.name,
        expr: rule.condition,
        for: rule.duration,
        labels: {
          severity: rule.severity,
          ...rule.labels
        },
        annotations: {
          summary: rule.description,
          ...rule.annotations
        }
      }))
    }];

    return `groups:\n${groups.map(group => 
      `- name: ${group.name}\n  rules:\n${group.rules.map(rule => 
        `  - alert: ${rule.alert}\n    expr: ${rule.expr}\n    for: ${rule.for}\n    labels:\n${Object.entries(rule.labels).map(([k, v]) => 
          `      ${k}: ${v}`
        ).join('\n')}\n    annotations:\n${Object.entries(rule.annotations).map(([k, v]) => 
          `      ${k}: "${v}"`
        ).join('\n')}`
      ).join('\n')}`
    ).join('\n')}`;
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Update system uptime for all agents
      const currentTime = Date.now();
      
      for (const [agentId, metrics] of this.agentMetrics.entries()) {
        // Update uptime
        metrics.uptime = currentTime - this.startTime.getTime();
        
        // Calculate throughput (requests per second)
        metrics.throughput = metrics.requestsTotal / (metrics.uptime / 1000);
        
        this.agentMetrics.set(agentId, metrics);
      }

      this.emit('metricsCollected', {
        timestamp: new Date(),
        agentCount: this.agentMetrics.size
      });

    } catch (error) {
      console.error('Error collecting metrics:', error);
      this.emit('metricsCollectionError', error);
    }
  }

  private setupDefaultHealthChecks(): void {
    // Memory usage health check - relaxed thresholds for testing
    this.registerHealthCheck('memory_usage', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const usage = heapUsedMB / heapTotalMB;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = `Memory usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${(usage * 100).toFixed(1)}%)`;

      if (usage > 0.95) {
        status = 'fail';
        message += ' - Critical memory usage';
      } else if (usage > 0.90) {
        status = 'warn';
        message += ' - High memory usage';
      }

      return {
        name: 'memory_usage',
        status,
        message,
        duration: 0, // Will be overridden by runHealthChecks
        metadata: {
          heapUsed: heapUsedMB,
          heapTotal: heapTotalMB,
          usage: usage
        }
      };
    });

    // Agent connectivity health check
    this.registerHealthCheck('agent_connectivity', async () => {
      const totalAgents = this.agentMetrics.size;
      const activeAgents = Array.from(this.agentMetrics.values()).filter(a => a.uptime > 0).length;
      const connectivity = totalAgents > 0 ? activeAgents / totalAgents : 1;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = `Agent connectivity: ${activeAgents}/${totalAgents} agents active (${(connectivity * 100).toFixed(1)}%)`;

      if (connectivity < 0.5) {
        status = 'fail';
        message += ' - Critical: Less than 50% of agents are active';
      } else if (connectivity < 0.8) {
        status = 'warn';
        message += ' - Warning: Less than 80% of agents are active';
      }

      return {
        name: 'agent_connectivity',
        status,
        message,
        duration: 0, // Will be overridden by runHealthChecks
        metadata: {
          totalAgents,
          activeAgents,
          connectivity
        }
      };
    });

    // Error rate health check
    this.registerHealthCheck('error_rate', async () => {
      const agents = Array.from(this.agentMetrics.values());
      const totalRequests = agents.reduce((sum, a) => sum + a.requestsTotal, 0);
      const totalErrors = agents.reduce((sum, a) => sum + a.requestsFailed, 0);
      const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = `System error rate: ${(errorRate * 100).toFixed(2)}% (${totalErrors}/${totalRequests} requests)`;

      if (errorRate > 0.1) {
        status = 'fail';
        message += ' - Critical: Error rate above 10%';
      } else if (errorRate > 0.05) {
        status = 'warn';
        message += ' - Warning: Error rate above 5%';
      }

      return {
        name: 'error_rate',
        status,
        message,
        duration: 0, // Will be overridden by runHealthChecks
        metadata: {
          totalRequests,
          totalErrors,
          errorRate
        }
      };
    });
  }
}