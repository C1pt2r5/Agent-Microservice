"use strict";
/**
 * Comprehensive Metrics Collection and Monitoring System
 * Provides Prometheus metrics, custom KPIs, and health monitoring for agents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
const events_1 = require("events");
const prom_client_1 = require("prom-client");
class MetricsCollector extends events_1.EventEmitter {
    constructor() {
        super();
        this.metrics = new Map();
        this.agentMetrics = new Map();
        this.healthChecks = new Map();
        this.alertRules = [];
        this.isCollecting = false;
        this.startTime = new Date();
        this.customMetrics = new Map();
        this.initializePrometheusMetrics();
        this.setupDefaultHealthChecks();
    }
    /**
     * Initialize Prometheus metrics
     */
    initializePrometheusMetrics() {
        // Enable default metrics collection
        (0, prom_client_1.collectDefaultMetrics)({ register: prom_client_1.register });
        // Request metrics
        this.requestsTotal = new prom_client_1.Counter({
            name: 'agent_requests_total',
            help: 'Total number of requests processed by agents',
            labelNames: ['agent_id', 'agent_type', 'method', 'status'],
            registers: [prom_client_1.register]
        });
        this.requestDuration = new prom_client_1.Histogram({
            name: 'agent_request_duration_seconds',
            help: 'Duration of agent requests in seconds',
            labelNames: ['agent_id', 'agent_type', 'method'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
            registers: [prom_client_1.register]
        });
        // Connection metrics
        this.activeConnections = new prom_client_1.Gauge({
            name: 'agent_active_connections',
            help: 'Number of active connections per agent',
            labelNames: ['agent_id', 'agent_type'],
            registers: [prom_client_1.register]
        });
        // System metrics
        this.agentUptime = new prom_client_1.Gauge({
            name: 'agent_uptime_seconds',
            help: 'Agent uptime in seconds',
            labelNames: ['agent_id', 'agent_type'],
            registers: [prom_client_1.register]
        });
        this.memoryUsage = new prom_client_1.Gauge({
            name: 'agent_memory_usage_bytes',
            help: 'Agent memory usage in bytes',
            labelNames: ['agent_id', 'agent_type'],
            registers: [prom_client_1.register]
        });
        this.cpuUsage = new prom_client_1.Gauge({
            name: 'agent_cpu_usage_percent',
            help: 'Agent CPU usage percentage',
            labelNames: ['agent_id', 'agent_type'],
            registers: [prom_client_1.register]
        });
        this.errorRate = new prom_client_1.Gauge({
            name: 'agent_error_rate',
            help: 'Agent error rate (0-1)',
            labelNames: ['agent_id', 'agent_type'],
            registers: [prom_client_1.register]
        });
    }
    /**
     * Start metrics collection
     */
    startCollection(intervalMs = 15000) {
        if (this.isCollecting) {
            return;
        }
        this.isCollecting = true;
        this.collectionInterval = setInterval(async () => {
            try {
                await this.collectMetrics();
            }
            catch (error) {
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
    stopCollection() {
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
    registerAgent(agentId, agentType) {
        const metrics = {
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
    unregisterAgent(agentId) {
        this.agentMetrics.delete(agentId);
        this.emit('agentUnregistered', { agentId });
    }
    /**
     * Record a request metric
     */
    recordRequest(agentId, agentType, method, status, duration) {
        // Update Prometheus metrics
        this.requestsTotal.inc({ agent_id: agentId, agent_type: agentType, method, status });
        this.requestDuration.observe({ agent_id: agentId, agent_type: agentType, method }, duration / 1000);
        // Update agent metrics
        const metrics = this.agentMetrics.get(agentId);
        if (metrics) {
            metrics.requestsTotal++;
            if (status === 'success') {
                metrics.requestsSuccessful++;
            }
            else {
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
    updateAgentMetrics(agentId, updates) {
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
    createCustomMetric(definition) {
        let metric;
        switch (definition.type) {
            case 'counter':
                metric = new prom_client_1.Counter({
                    name: definition.name,
                    help: definition.help,
                    labelNames: definition.labels || [],
                    registers: [prom_client_1.register]
                });
                break;
            case 'gauge':
                metric = new prom_client_1.Gauge({
                    name: definition.name,
                    help: definition.help,
                    labelNames: definition.labels || [],
                    registers: [prom_client_1.register]
                });
                break;
            case 'histogram':
                metric = new prom_client_1.Histogram({
                    name: definition.name,
                    help: definition.help,
                    labelNames: definition.labels || [],
                    buckets: definition.buckets || [0.1, 0.5, 1, 2, 5, 10],
                    registers: [prom_client_1.register]
                });
                break;
            case 'summary':
                metric = new prom_client_1.Summary({
                    name: definition.name,
                    help: definition.help,
                    labelNames: definition.labels || [],
                    percentiles: definition.percentiles || [0.5, 0.9, 0.95, 0.99],
                    registers: [prom_client_1.register]
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
    updateCustomMetric(name, value, labels, operation = 'set') {
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
    registerHealthCheck(name, checkFunction) {
        this.healthChecks.set(name, checkFunction);
        this.emit('healthCheckRegistered', { name });
    }
    /**
     * Unregister health check
     */
    unregisterHealthCheck(name) {
        this.healthChecks.delete(name);
        this.emit('healthCheckUnregistered', { name });
    }
    /**
     * Run all health checks
     */
    async runHealthChecks() {
        const startTime = Date.now();
        const checks = [];
        let overallStatus = 'healthy';
        for (const [name, checkFunction] of this.healthChecks.entries()) {
            const checkStartTime = Date.now();
            try {
                const check = await checkFunction();
                // Ensure duration is set properly
                check.duration = Date.now() - checkStartTime;
                checks.push(check);
                if (check.status === 'fail') {
                    overallStatus = 'unhealthy';
                }
                else if (check.status === 'warn' && overallStatus === 'healthy') {
                    overallStatus = 'degraded';
                }
            }
            catch (error) {
                checks.push({
                    name,
                    status: 'fail',
                    message: `Health check failed: ${error}`,
                    duration: Date.now() - checkStartTime
                });
                overallStatus = 'unhealthy';
            }
        }
        const result = {
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
    getAgentMetrics(agentId) {
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
    getSystemMetrics() {
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
    async getPrometheusMetrics() {
        return prom_client_1.register.metrics();
    }
    /**
     * Add alert rule
     */
    addAlertRule(rule) {
        this.alertRules.push(rule);
        this.emit('alertRuleAdded', rule);
    }
    /**
     * Remove alert rule
     */
    removeAlertRule(name) {
        const index = this.alertRules.findIndex(rule => rule.name === name);
        if (index !== -1) {
            const removed = this.alertRules.splice(index, 1)[0];
            this.emit('alertRuleRemoved', removed);
        }
    }
    /**
     * Get alert rules
     */
    getAlertRules() {
        return [...this.alertRules];
    }
    /**
     * Generate Prometheus alert rules configuration
     */
    generatePrometheusAlertRules() {
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
        return `groups:\n${groups.map(group => `- name: ${group.name}\n  rules:\n${group.rules.map(rule => `  - alert: ${rule.alert}\n    expr: ${rule.expr}\n    for: ${rule.for}\n    labels:\n${Object.entries(rule.labels).map(([k, v]) => `      ${k}: ${v}`).join('\n')}\n    annotations:\n${Object.entries(rule.annotations).map(([k, v]) => `      ${k}: "${v}"`).join('\n')}`).join('\n')}`).join('\n')}`;
    }
    async collectMetrics() {
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
        }
        catch (error) {
            console.error('Error collecting metrics:', error);
            this.emit('metricsCollectionError', error);
        }
    }
    setupDefaultHealthChecks() {
        // Memory usage health check - relaxed thresholds for testing
        this.registerHealthCheck('memory_usage', async () => {
            const memUsage = process.memoryUsage();
            const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
            const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
            const usage = heapUsedMB / heapTotalMB;
            let status = 'pass';
            let message = `Memory usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${(usage * 100).toFixed(1)}%)`;
            if (usage > 0.95) {
                status = 'fail';
                message += ' - Critical memory usage';
            }
            else if (usage > 0.90) {
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
            let status = 'pass';
            let message = `Agent connectivity: ${activeAgents}/${totalAgents} agents active (${(connectivity * 100).toFixed(1)}%)`;
            if (connectivity < 0.5) {
                status = 'fail';
                message += ' - Critical: Less than 50% of agents are active';
            }
            else if (connectivity < 0.8) {
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
            let status = 'pass';
            let message = `System error rate: ${(errorRate * 100).toFixed(2)}% (${totalErrors}/${totalRequests} requests)`;
            if (errorRate > 0.1) {
                status = 'fail';
                message += ' - Critical: Error rate above 10%';
            }
            else if (errorRate > 0.05) {
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
exports.MetricsCollector = MetricsCollector;
//# sourceMappingURL=metrics.js.map