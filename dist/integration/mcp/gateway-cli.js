#!/usr/bin/env node
"use strict";
/**
 * CLI tool for starting the MCP Gateway
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_gateway_1 = require("./mcp-gateway");
const gateway_config_1 = require("./gateway-config");
async function main() {
    try {
        console.log('Starting MCP Gateway...');
        // Load configuration
        const config = process.env.NODE_ENV === 'development'
            ? gateway_config_1.GatewayConfigManager.createDevelopmentConfig()
            : gateway_config_1.GatewayConfigManager.loadFromEnvironment();
        // Validate configuration
        const errors = gateway_config_1.GatewayConfigManager.validateConfig(config);
        if (errors.length > 0) {
            console.error('Configuration errors:');
            errors.forEach(error => console.error(`  - ${error}`));
            process.exit(1);
        }
        console.log('Configuration loaded successfully');
        console.log(`Services configured: ${Object.keys(config.services).join(', ')}`);
        // Create and start gateway
        const gateway = new mcp_gateway_1.MCPGateway(config);
        const port = parseInt(process.env.PORT || '8080');
        await gateway.start(port);
        console.log(`MCP Gateway is running on port ${port}`);
        console.log('Available endpoints:');
        console.log(`  - Health Check: http://localhost:${port}/mcp/health`);
        console.log(`  - Service Discovery: http://localhost:${port}/mcp/services`);
        console.log(`  - MCP Requests: http://localhost:${port}/mcp/request`);
    }
    catch (error) {
        console.error('Failed to start MCP Gateway:', error);
        process.exit(1);
    }
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    process.exit(0);
});
if (require.main === module) {
    main();
}
//# sourceMappingURL=gateway-cli.js.map