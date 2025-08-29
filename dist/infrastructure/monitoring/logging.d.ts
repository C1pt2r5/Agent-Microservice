/**
 * Comprehensive Logging and Distributed Tracing Infrastructure
 * Provides structured logging, correlation IDs, and centralized log aggregation
 */
import { EventEmitter } from 'events';
export declare enum LogLevel {
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
export declare class Logger extends EventEmitter {
    private config;
    private logBuffer;
    private traces;
    private activeSpans;
    private correlationContext;
    private flushInterval?;
    private logHistory;
    private maxHistorySize;
    constructor(config?: Partial<LoggerConfig>);
    /**
     * Create a child logger with additional context
     */
    child(context: {
        agentId?: string;
        agentType?: string;
        component?: string;
    }): Logger;
    /**
     * Set context for correlation
     */
    setContext(key: string, value: string): void;
    /**
     * Get context value
     */
    getContext(key: string): string | undefined;
    /**
     * Clear context
     */
    clearContext(): void;
    /**
     * Start a new trace
     */
    startTrace(operationName: string, parentSpanId?: string): string;
    /**
     * Finish a trace span
     */
    finishSpan(spanId: string, status?: 'completed' | 'error'): void;
    /**
     * Add tags to current span
     */
    addSpanTags(tags: Record<string, string>): void;
    /**
     * Log trace event
     */
    trace(message: string, metadata?: Record<string, any>): void;
    /**
     * Log debug message
     */
    debug(message: string, metadata?: Record<string, any>): void;
    /**
     * Log info message
     */
    info(message: string, metadata?: Record<string, any>): void;
    /**
     * Log warning message
     */
    warn(message: string, metadata?: Record<string, any>): void;
    /**
     * Log error message
     */
    error(message: string, error?: Error, metadata?: Record<string, any>): void;
    /**
     * Log fatal message
     */
    fatal(message: string, error?: Error, metadata?: Record<string, any>): void;
    /**
     * Log with timing information
     */
    time<T>(operationName: string, operation: () => Promise<T>): Promise<T>;
    /**
     * Core logging method
     */
    private log;
    /**
     * Flush log buffer
     */
    flush(): Promise<void>;
    /**
     * Search logs
     */
    searchLogs(filter: LogFilter): LogEntry[];
    /**
     * Get log aggregation
     */
    getLogAggregation(filter?: LogFilter): LogAggregation;
    /**
     * Get trace information
     */
    getTrace(traceId: string): TraceSpan | undefined;
    /**
     * Get all traces
     */
    getAllTraces(): TraceSpan[];
    /**
     * Get active spans
     */
    getActiveSpans(): TraceSpan[];
    /**
     * Export logs in JSON format
     */
    exportLogs(filter?: LogFilter): string;
    /**
     * Import logs from JSON
     */
    importLogs(jsonData: string): void;
    /**
     * Cleanup old logs and traces
     */
    cleanup(maxAge?: number): void;
    /**
     * Shutdown logger
     */
    shutdown(): Promise<void>;
    private generateCorrelationId;
    private getTraceIdFromSpan;
    private extractTags;
    private outputToConsole;
    private writeToFile;
    private sendToCentralized;
    private startFlushInterval;
}
/**
 * Global logger instance
 */
export declare const logger: Logger;
/**
 * Create logger for specific agent
 */
export declare function createAgentLogger(agentId: string, agentType: string): Logger;
/**
 * Create logger for specific component
 */
export declare function createComponentLogger(component: string): Logger;
//# sourceMappingURL=logging.d.ts.map