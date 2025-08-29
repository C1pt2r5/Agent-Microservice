"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComponentLogger = exports.createAgentLogger = exports.logger = exports.LogLevel = exports.Logger = exports.MetricsCollector = void 0;
__exportStar(require("./metrics"), exports);
__exportStar(require("./logging"), exports);
// Re-export commonly used types and classes
var metrics_1 = require("./metrics");
Object.defineProperty(exports, "MetricsCollector", { enumerable: true, get: function () { return metrics_1.MetricsCollector; } });
var logging_1 = require("./logging");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logging_1.Logger; } });
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return logging_1.LogLevel; } });
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logging_1.logger; } });
Object.defineProperty(exports, "createAgentLogger", { enumerable: true, get: function () { return logging_1.createAgentLogger; } });
Object.defineProperty(exports, "createComponentLogger", { enumerable: true, get: function () { return logging_1.createComponentLogger; } });
//# sourceMappingURL=index.js.map