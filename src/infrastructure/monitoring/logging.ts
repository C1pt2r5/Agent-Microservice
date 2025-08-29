/**
 * Comprehensive Logging and Distributed Tracing Infrastructure
 * Provides structured logging, correlation IDs, and centralized log aggregation
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  agentId?: string;
  agentType?: string;
  component?: string;
  metadata?: Record<string, any>;
  error?: Error;
  duration?: number;
  tags?: Record<string, string>;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, string>;
  logs: LogEntry[];
  status: 'active' | 'completed' | 'error';
  agentId?: string;
  agentType?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableCentralized: boolean;
  filePath?: string;
  centralizedEndpoint?: string;
  enableTracing: boolean;
  enableCorrelation: boolean;
  maxLogSize?: number;
  rotationInterval?: number;
  bufferSize?: number;
  flushInterval?: number;
}

export interface LogFilter {
  level?: LogLevel;
  agentId?: string;
  agentType?: string;
  component?: string;
  correlationId?: string;
  traceId?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  tags?: Record<string, string>;
}

export interface LogAggregation {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByAgent: Record<string, number>;
  logsByComponent: Record<string, number>;
  errorRate: number;
  averageResponseTime: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurrence: Date;
  }>;
}

export class Logger extends EventEmitter {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private traces: Map<string, TraceSpan> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private correlationContext: Map<string, string> = new Map();
  private flushInterval?: NodeJS.Timeout;
  private logHistory: LogEntry[] = [];
  private maxHistorySize: number = 10000;

  constructor(config: Partial<LoggerConfig> = {}) {
    super();
    
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableCentralized: false,
      enableTracing: true,
      enableCorrelation: true,
      bufferSize: 1000,
      flushInterval: 5000,
      maxLogSize: 100 * 1024 * 1024, // 100MB
      rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };

    this.startFlushInterval();
  }

  /**
   * Create a child logger with additional context
   */
  child(context: { agentId?: string; agentType?: string; component?: string }): Logger {
    const childLogger = new Logger(this.config);
    
    // Copy context to child
    if (context.agentId) childLogger.setContext('agentId', context.agentId);
    if (context.agentType) childLogger.setContext('agentType', context.agentType);
    if (context.component) childLogger.setContext('component', context.component);
    
    return childLogger;
  }

  /**
   * Set context for correlation
   */
  setContext(key: string, value: string): void {
    this.correlationContext.set(key, value);
  }

  /**
   * Get context value
   */
  getContext(key: string): string | undefined {
    return this.correlationContext.get(key);
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.correlationContext.clear();
  }

  /**
   * Start a new trace
   */
  startTrace(operationName: string, parentSpanId?: string): string {
    const traceId = parentSpanId ? this.getTraceIdFromSpan(parentSpanId) : randomUUID();
    const spanId = randomUUID();
    
    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: new Date(),
      tags: {},
      logs: [],
      status: 'active',
      agentId: this.getContext('agentId'),
      agentType: this.getContext('agentType')
    };

    this.traces.set(traceId, span);
    this.activeSpans.set(spanId, span);
    
    this.setContext('traceId', traceId);
    this.setContext('spanId', spanId);

    this.emit('traceStarted', span);
    return spanId;
  }

  /**
   * Finish a trace span
   */
  finishSpan(spanId: string, status: 'completed' | 'error' = 'completed'): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = status;

    this.activeSpans.delete(spanId);
    this.emit('spanFinished', span);
  }

  /**
   * Add tags to current span
   */
  addSpanTags(tags: Record<string, string>): void {
    const spanId = this.getContext('spanId');
    if (!spanId) return;

    const span = this.activeSpans.get(spanId);
    if (span) {
      Object.assign(span.tags, tags);
    }
  }

  /**
   * Log trace event
   */
  trace(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, metadata);
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, metadata, error);
  }

  /**
   * Log with timing information
   */
  time<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const spanId = this.startTrace(operationName);
    
    return operation()
      .then(result => {
        const duration = Date.now() - startTime;
        this.info(`${operationName} completed`, { duration });
        this.finishSpan(spanId, 'completed');
        return result;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        this.error(`${operationName} failed`, error, { duration });
        this.finishSpan(spanId, 'error');
        throw error;
      });
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      correlationId: this.generateCorrelationId(),
      traceId: this.getContext('traceId'),
      spanId: this.getContext('spanId'),
      agentId: this.getContext('agentId'),
      agentType: this.getContext('agentType'),
      component: this.getContext('component'),
      metadata,
      error,
      tags: this.extractTags(metadata)
    };

    // Add to current span if active
    const spanId = this.getContext('spanId');
    if (spanId) {
      const span = this.activeSpans.get(spanId);
      if (span) {
        span.logs.push(entry);
      }
    }

    // Add to buffer
    this.logBuffer.push(entry);
    
    // Add to history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Emit event
    this.emit('logEntry', entry);

    // Console output if enabled
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Flush if buffer is full
    if (this.logBuffer.length >= (this.config.bufferSize || 1000)) {
      this.flush();
    }
  }

  /**
   * Flush log buffer
   */
  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Write to file if enabled
      if (this.config.enableFile && this.config.filePath) {
        await this.writeToFile(entries);
      }

      // Send to centralized logging if enabled
      if (this.config.enableCentralized && this.config.centralizedEndpoint) {
        await this.sendToCentralized(entries);
      }

      this.emit('logsFlushed', { count: entries.length });

    } catch (error) {
      console.error('Failed to flush logs:', error);
      this.emit('flushError', error);
      
      // Put entries back in buffer for retry
      this.logBuffer.unshift(...entries);
    }
  }

  /**
   * Search logs
   */
  searchLogs(filter: LogFilter): LogEntry[] {
    return this.logHistory.filter(entry => {
      if (filter.level !== undefined && entry.level < filter.level) return false;
      if (filter.agentId && entry.agentId !== filter.agentId) return false;
      if (filter.agentType && entry.agentType !== filter.agentType) return false;
      if (filter.component && entry.component !== filter.component) return false;
      if (filter.correlationId && entry.correlationId !== filter.correlationId) return false;
      if (filter.traceId && entry.traceId !== filter.traceId) return false;
      
      if (filter.timeRange) {
        if (entry.timestamp < filter.timeRange.start || entry.timestamp > filter.timeRange.end) {
          return false;
        }
      }
      
      if (filter.tags) {
        for (const [key, value] of Object.entries(filter.tags)) {
          if (!entry.tags || entry.tags[key] !== value) return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Get log aggregation
   */
  getLogAggregation(filter?: LogFilter): LogAggregation {
    const logs = filter ? this.searchLogs(filter) : this.logHistory;
    
    const logsByLevel: Record<LogLevel, number> = {
      [LogLevel.TRACE]: 0,
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.FATAL]: 0
    };
    
    const logsByAgent: Record<string, number> = {};
    const logsByComponent: Record<string, number> = {};
    const errorCounts: Record<string, { count: number; lastOccurrence: Date }> = {};
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const log of logs) {
      logsByLevel[log.level]++;
      
      if (log.agentId) {
        logsByAgent[log.agentId] = (logsByAgent[log.agentId] || 0) + 1;
      }
      
      if (log.component) {
        logsByComponent[log.component] = (logsByComponent[log.component] || 0) + 1;
      }
      
      if (log.level >= LogLevel.ERROR && log.error) {
        const errorKey = log.error.message;
        if (errorCounts[errorKey]) {
          errorCounts[errorKey].count++;
          errorCounts[errorKey].lastOccurrence = log.timestamp;
        } else {
          errorCounts[errorKey] = { count: 1, lastOccurrence: log.timestamp };
        }
      }
      
      if (log.duration) {
        totalResponseTime += log.duration;
        responseTimeCount++;
      }
    }

    const errorLogs = logsByLevel[LogLevel.ERROR] + logsByLevel[LogLevel.FATAL];
    const errorRate = logs.length > 0 ? errorLogs / logs.length : 0;
    const averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    const topErrors = Object.entries(errorCounts)
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLogs: logs.length,
      logsByLevel,
      logsByAgent,
      logsByComponent,
      errorRate,
      averageResponseTime,
      topErrors
    };
  }

  /**
   * Get trace information
   */
  getTrace(traceId: string): TraceSpan | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces
   */
  getAllTraces(): TraceSpan[] {
    return Array.from(this.traces.values());
  }

  /**
   * Get active spans
   */
  getActiveSpans(): TraceSpan[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Export logs in JSON format
   */
  exportLogs(filter?: LogFilter): string {
    const logs = filter ? this.searchLogs(filter) : this.logHistory;
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Import logs from JSON
   */
  importLogs(jsonData: string): void {
    try {
      const logs: LogEntry[] = JSON.parse(jsonData);
      this.logHistory.push(...logs);
      
      // Trim to max size
      if (this.logHistory.length > this.maxHistorySize) {
        this.logHistory = this.logHistory.slice(-this.maxHistorySize);
      }
      
      this.emit('logsImported', { count: logs.length });
    } catch (error) {
      throw new Error(`Failed to import logs: ${error}`);
    }
  }

  /**
   * Cleanup old logs and traces
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    
    // Clean old logs
    const initialLogCount = this.logHistory.length;
    this.logHistory = this.logHistory.filter(log => log.timestamp > cutoff);
    
    // Clean old traces
    const initialTraceCount = this.traces.size;
    for (const [traceId, trace] of this.traces.entries()) {
      if (trace.startTime < cutoff && trace.status !== 'active') {
        this.traces.delete(traceId);
      }
    }
    
    this.emit('cleanupCompleted', {
      logsRemoved: initialLogCount - this.logHistory.length,
      tracesRemoved: initialTraceCount - this.traces.size
    });
  }

  /**
   * Shutdown logger
   */
  async shutdown(): Promise<void> {
    // Stop flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Final flush
    await this.flush();
    
    this.emit('shutdown');
  }

  private generateCorrelationId(): string {
    if (!this.config.enableCorrelation) return '';
    
    let correlationId = this.getContext('correlationId');
    if (!correlationId) {
      correlationId = randomUUID();
      this.setContext('correlationId', correlationId);
    }
    
    return correlationId;
  }

  private getTraceIdFromSpan(spanId: string): string {
    const span = this.activeSpans.get(spanId);
    return span ? span.traceId : randomUUID();
  }

  private extractTags(metadata?: Record<string, any>): Record<string, string> {
    if (!metadata) return {};
    
    const tags: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        tags[key] = String(value);
      }
    }
    
    return tags;
  }

  private outputToConsole(entry: LogEntry): void {
    const levelNames = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const levelColors = ['\x1b[37m', '\x1b[36m', '\x1b[32m', '\x1b[33m', '\x1b[31m', '\x1b[35m'];
    const resetColor = '\x1b[0m';
    
    const timestamp = entry.timestamp.toISOString();
    const level = levelNames[entry.level];
    const color = levelColors[entry.level];
    
    let output = `${color}[${timestamp}] ${level}${resetColor}`;
    
    if (entry.agentId) output += ` [${entry.agentId}]`;
    if (entry.component) output += ` [${entry.component}]`;
    if (entry.traceId) output += ` [trace:${entry.traceId.substring(0, 8)}]`;
    
    output += `: ${entry.message}`;
    
    if (entry.metadata) {
      output += ` ${JSON.stringify(entry.metadata)}`;
    }
    
    console.log(output);
    
    if (entry.error) {
      console.error(entry.error);
    }
  }

  private async writeToFile(entries: LogEntry[]): Promise<void> {
    // File writing implementation would go here
    // For now, just emit an event
    this.emit('fileWrite', { entries, path: this.config.filePath });
  }

  private async sendToCentralized(entries: LogEntry[]): Promise<void> {
    // Centralized logging implementation would go here
    // For now, just emit an event
    this.emit('centralizedSend', { entries, endpoint: this.config.centralizedEndpoint });
  }

  private startFlushInterval(): void {
    if (this.config.flushInterval && this.config.flushInterval > 0) {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableTracing: true,
  enableCorrelation: true
});

/**
 * Create logger for specific agent
 */
export function createAgentLogger(agentId: string, agentType: string): Logger {
  return logger.child({ agentId, agentType });
}

/**
 * Create logger for specific component
 */
export function createComponentLogger(component: string): Logger {
  return logger.child({ component });
}