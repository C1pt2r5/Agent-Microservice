"use strict";
/**
 * Main entry point for the agentic microservices system
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = exports.Monitoring = void 0;
exports.bootstrap = bootstrap;
const dotenv_1 = require("dotenv");
// Load environment variables
(0, dotenv_1.config)();
// Export types
__exportStar(require("./types"), exports);
// Export agents
__exportStar(require("./agents"), exports);
// Export integration
__exportStar(require("./integration"), exports);
// Export infrastructure with specific naming to avoid conflicts
__exportStar(require("./infrastructure/adk"), exports);
__exportStar(require("./infrastructure/config"), exports);
// Export monitoring with namespace to avoid conflicts
exports.Monitoring = __importStar(require("./infrastructure/monitoring"));
// Main application bootstrap
async function bootstrap(agentConfig) {
    console.log(`Starting ${agentConfig.name} agent...`);
    console.log(`Environment: ${agentConfig.environment}`);
    console.log(`Agent Type: ${agentConfig.type}`);
    // Agent initialization will be implemented in subsequent tasks
    console.log('Agent bootstrap complete');
}
// Export default configuration template
exports.defaultConfig = {
    id: '',
    name: '',
    type: 'chatbot',
    version: '1.0.0',
    environment: 'development',
    mcpEndpoint: {
        url: 'http://localhost:8080',
        timeout: 30000,
        retryAttempts: 3,
        circuitBreakerThreshold: 5
    },
    a2aEndpoint: {
        url: 'http://localhost:8081',
        timeout: 15000,
        retryAttempts: 3,
        circuitBreakerThreshold: 5
    },
    geminiConfig: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: 'gemini-pro',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
    },
    capabilities: []
};
//# sourceMappingURL=index.js.map