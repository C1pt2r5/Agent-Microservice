/**
 * Recommendation Service Integration
 * Handles MCP integration, A2A messaging, caching, and API endpoints
 */
import { EventEmitter } from 'events';
import { AgentConfig } from '../../types';
export interface RecommendationServiceConfig extends AgentConfig {
    server: {
        port: number;
        host: string;
        cors: {
            enabled: boolean;
            origins: string[];
        };
    };
    api: {
        rateLimit: {
            windowMs: number;
            maxRequests: number;
        };
        authentication: {
            enabled: boolean;
            apiKeyHeader: string;
        };
    };
    caching: {
        enabled: boolean;
        ttl: number;
        maxSize: number;
        strategy: 'lru' | 'fifo' | 'ttl';
    };
    analytics: {
        enabled: boolean;
        trackingEvents: string[];
        batchSize: number;
        flushInterval: number;
    };
    monitoring: {
        metricsEnabled: boolean;
        loggingLevel: 'debug' | 'info' | 'warn' | 'error';
    };
}
export interface CacheEntry<T> {
    data: T;
    timestamp: Date;
    ttl: number;
    accessCount: number;
    lastAccessed: Date;
}
export interface AnalyticsEvent {
    eventId: string;
    userId: string;
    eventType: string;
    timestamp: Date;
    data: Record<string, any>;
    sessionId?: string;
}
export interface ServiceMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    cacheHitRate: number;
    activeUsers: number;
    recommendationsServed: number;
    uptime: number;
}
export declare class RecommendationService extends EventEmitter {
    private agent;
    private config;
    private app;
    private server;
    private cache;
    private isRunning;
    private startTime;
    private metrics;
    private rateLimitMap;
    private analyticsQueue;
    private analyticsInterval?;
    private cacheCleanupInterval?;
    constructor(config: RecommendationServiceConfig);
    /**
     * Initialize and start the recommendation service
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the service gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Get service health status
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        metrics: ServiceMetrics;
        agentHealth: boolean;
        cacheStats: {
            size: number;
            hitRate: number;
            maxSize: number;
        };
    };
    private setupExpress;
    private setupRoutes;
    private getRecommendations;
    private getUserRecommendations;
    private getSimilarUsers;
    private getProduct;
    private getUserProfile;
    private trackUserInteraction;
    private recordFeedback;
    private trackEvent;
    private clearCache;
    private getCacheStats;
    private getStatistics;
    private getMetrics;
    private generateCacheKey;
    private getFromCache;
    private setCache;
    private evictCacheEntries;
    private invalidateUserCaches;
    private trackAnalyticsEvent;
    private flushAnalytics;
    private setupA2ASubscriptions;
    private handleA2AMessage;
    private handleUserBehaviorUpdate;
    private handleFraudAlert;
    private handleInteractionTracked;
    private startBackgroundTasks;
    private startServer;
    private authenticateRequest;
    private rateLimitMiddleware;
    private updateMetrics;
    private updateServiceMetrics;
    private setupEventListeners;
}
//# sourceMappingURL=recommendation-service.d.ts.map