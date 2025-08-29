#!/usr/bin/env node
"use strict";
/**
 * CLI tool for starting the A2A Hub
 */
Object.defineProperty(exports, "__esModule", { value: true });
const a2a_hub_1 = require("./a2a-hub");
async function main() {
    try {
        console.log('Starting A2A Hub...');
        // Load configuration from environment variables
        const config = {
            port: parseInt(process.env.A2A_HUB_PORT || '8081'),
            maxConnections: parseInt(process.env.A2A_MAX_CONNECTIONS || '1000'),
            heartbeatInterval: parseInt(process.env.A2A_HEARTBEAT_INTERVAL || '30000'),
            messageRetention: parseInt(process.env.A2A_MESSAGE_RETENTION || '86400000'),
            enablePersistence: process.env.A2A_ENABLE_PERSISTENCE !== 'false',
            enableMetrics: process.env.A2A_ENABLE_METRICS !== 'false'
        };
        console.log('Configuration loaded:');
        console.log(`  - Port: ${config.port}`);
        console.log(`  - Max Connections: ${config.maxConnections}`);
        console.log(`  - Heartbeat Interval: ${config.heartbeatInterval}ms`);
        console.log(`  - Message Retention: ${config.messageRetention}ms`);
        console.log(`  - Persistence: ${config.enablePersistence}`);
        console.log(`  - Metrics: ${config.enableMetrics}`);
        // Create and start hub
        const hub = new a2a_hub_1.A2AHub(config);
        // Set up event listeners
        hub.on('started', () => {
            console.log(`A2A Hub is running on port ${config.port}`);
            console.log('Available endpoints:');
            console.log(`  - Health Check: http://localhost:${config.port}/health`);
            console.log(`  - Agent Registration: http://localhost:${config.port}/agents/register`);
            console.log(`  - Topics: http://localhost:${config.port}/topics`);
            console.log(`  - Statistics: http://localhost:${config.port}/stats`);
            console.log(`  - WebSocket: ws://localhost:${config.port}/ws`);
        });
        hub.on('agentRegistered', (registration) => {
            console.log(`Agent registered: ${registration.agentId} (${registration.agentType})`);
        });
        hub.on('agentUnregistered', ({ agentId }) => {
            console.log(`Agent unregistered: ${agentId}`);
        });
        hub.on('messagePublished', ({ message, receipts }) => {
            console.log(`Message published: ${message.id} on topic ${message.topic} (${receipts.length} recipients)`);
        });
        hub.on('agentDisconnected', ({ agentId }) => {
            console.log(`Agent disconnected: ${agentId}`);
        });
        await hub.start();
    }
    catch (error) {
        console.error('Failed to start A2A Hub:', error);
        process.exit(1);
    }
}
// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    process.exit(0);
});
if (require.main === module) {
    main();
}
//# sourceMappingURL=hub-cli.js.map