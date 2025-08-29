"use strict";
/**
 * Agent-related type definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
class BaseAgent {
    constructor(config) {
        this.config = config;
        this.state = {
            id: config.id,
            status: 'initializing',
            lastHeartbeat: new Date(),
            metrics: {
                requestsProcessed: 0,
                averageResponseTime: 0,
                errorRate: 0,
                uptime: 0,
                memoryUsage: 0,
                cpuUsage: 0
            },
            errors: []
        };
    }
    getState() {
        return { ...this.state };
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=agent.types.js.map