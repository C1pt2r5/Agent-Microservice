/**
 * Comprehensive Metrics Collection and Monitoring System
 * Provides Prometheus metrics, custom KPIs, and health monitoring for agents
 */
import { EventEmitter } from 'events';
export interface MetricDefinition {
    name: string;
    help: string;
    type: 'counter' | 'gauge' | 'histogram' | 'summary';
    labels?: string[];
    buckets?: number[];
    percentiles?: number[];
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
    condition: string;
    severity: 'info' | 'warning' | 'critical';
    duration: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
}
export declare class MetricsCollector extends EventEmitter {
    private metrics;
    private agentMetrics;
    private healthChecks;
    private alertRules;
    private isCollecting;
    private collectionInterval?;
    private startTime;
    private requestsTotal;
    private requestDuration;
    private activeConnections;
    private agentUptime;
    private memoryUsage;
    private cpuUsage;
    private errorRate;
    private customMetrics;
    constructor();
    /**
     * Initialize Prometheus metrics
     */
    private initializePrometheusMetrics;
    /**
     * Start metrics collection
     */
    startCollection(intervalMs?: number): void;
    /**
     * Stop metrics collection
     */
    stopCollection(): void;
    /**
     * Register an agent for metrics collection
     */
    registerAgent(agentId: string, agentType: string): void;
    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: string): void;
    /**
     * Record a request metric
     */
    recordRequest(agentId: string, agentType: string, method: string, status: string, duration: number): void;
    /**
     * Update agent system metrics
     */
    updateAgentMetrics(agentId: string, updates: Partial<AgentMetrics>): void;
    /**
     * Create custom metric
     */
    createCustomMetric(definition: MetricDefinition): void;
    /**
     * Update custom metric
     */
    updateCustomMetric(name: string, value: number, labels?: Record<string, string>, operation?: 'inc' | 'dec' | 'set' | 'observe'): void;
    /**
     * Register health check
     */
    registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheck>): void;
    /**
     * Unregister health check
     */
    unregisterHealthCheck(name: string): void;
    /**
     * Run all health checks
     */
    runHealthChecks(): Promise<HealthCheckResult>;
    /**
     * Get agent metrics
     */
    getAgentMetrics(agentId?: string): AgentMetrics | AgentMetrics[];
    /**
     * Get system metrics
     */
    getSystemMetrics(): SystemMetrics;
    /**
     * Get Prometheus metrics
     */
    getPrometheusMetrics(): Promise<string>;
    /**
     * Add alert rule
     */
    addAlertRule(rule: AlertRule): void;
    /**
     * Remove alert rule
     */
    removeAlertRule(name: string): void;
    /**
     * Get alert rules
     */
    getAlertRules(): AlertRule[];
    /**
     * Generate Prometheus alert rules configuration
     */
    generatePrometheusAlertRules(): string;
    private collectMetrics;
    private setupDefaultHealthChecks;
}
//# sourceMappingURL=metrics.d.ts.map