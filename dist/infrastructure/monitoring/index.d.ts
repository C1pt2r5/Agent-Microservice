/**
 * Comprehensive Monitoring and Observability Infrastructure
 *
 * This module provides:
 * - Prometheus metrics collection and custom KPIs
 * - Structured logging with distributed tracing
 * - Health check endpoints and system monitoring
 * - Centralized log aggregation and search
 * - Alert rules and notification system
 */
export * from './metrics';
export * from './logging';
export { MetricsCollector, type AgentMetrics, type SystemMetrics, type HealthCheckResult, type AlertRule } from './metrics';
export { Logger, LogLevel, logger, createAgentLogger, createComponentLogger, type LogEntry, type TraceSpan, type LogFilter, type LogAggregation } from './logging';
//# sourceMappingURL=index.d.ts.map