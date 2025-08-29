"use strict";
/**
 * Global test setup for comprehensive cleanup and resource management
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Global test resources tracker
class TestResourceTracker {
    constructor() {
        this.resources = new Set();
        this.timers = new Set();
        this.intervals = new Set();
        this.eventEmitters = new Set();
    }
    trackResource(resource) {
        if (resource && typeof resource === 'object') {
            this.resources.add(resource);
        }
    }
    trackTimer(timer) {
        this.timers.add(timer);
    }
    trackInterval(interval) {
        this.intervals.add(interval);
    }
    trackEventEmitter(emitter) {
        this.eventEmitters.add(emitter);
    }
    async cleanup() {
        // Clear all tracked timers and intervals
        for (const timer of this.timers) {
            clearTimeout(timer);
        }
        this.timers.clear();
        for (const interval of this.intervals) {
            clearInterval(interval);
        }
        this.intervals.clear();
        // Clean up event emitters
        for (const emitter of this.eventEmitters) {
            emitter.removeAllListeners();
        }
        this.eventEmitters.clear();
        // Clean up other resources
        for (const resource of this.resources) {
            if (resource && typeof resource.disconnect === 'function') {
                try {
                    await resource.disconnect();
                }
                catch (error) {
                    // Ignore cleanup errors
                }
            }
            if (resource && typeof resource.close === 'function') {
                try {
                    await resource.close();
                }
                catch (error) {
                    // Ignore cleanup errors
                }
            }
            if (resource && typeof resource.shutdown === 'function') {
                try {
                    await resource.shutdown();
                }
                catch (error) {
                    // Ignore cleanup errors
                }
            }
        }
        this.resources.clear();
    }
}
// Global instance
const resourceTracker = new TestResourceTracker();
// Make tracker available globally for tests
global.testResourceTracker = resourceTracker;
// Enhanced Jest hooks with performance optimizations
beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    // Ensure clean state
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    // Disable background tasks in tests
    process.env.DISABLE_BACKGROUND_TASKS = 'true';
});
afterAll(async () => {
    // Final cleanup
    await resourceTracker.cleanup();
    // Clear any remaining timers
    jest.clearAllTimers();
    jest.useRealTimers();
    // Clean up environment variables
    delete process.env.DISABLE_BACKGROUND_TASKS;
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
});
beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    jest.clearAllTimers();
    // Ensure test environment is set
    process.env.NODE_ENV = 'test';
    process.env.DISABLE_BACKGROUND_TASKS = 'true';
});
afterEach(async () => {
    // Clean up resources after each test
    await resourceTracker.cleanup();
    // Clear timers and intervals more aggressively
    jest.clearAllTimers();
    jest.runOnlyPendingTimers();
    // Clear any pending promises with timeout
    await Promise.race([
        new Promise(resolve => setImmediate(resolve)),
        new Promise(resolve => setTimeout(resolve, 100)) // 100ms timeout
    ]);
    // Clean up environment variables
    delete process.env.DISABLE_BACKGROUND_TASKS;
});
// Mock console methods to reduce noise during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.error = (...args) => {
    // Only log errors that are not related to test cleanup
    if (!args.some(arg => typeof arg === 'string' && (arg.includes('ECONNREFUSED') ||
        arg.includes('WebSocket') ||
        arg.includes('connection') ||
        arg.includes('test cleanup')))) {
        originalConsoleError(...args);
    }
};
console.warn = (...args) => {
    // Only log warnings that are not related to test cleanup
    if (!args.some(arg => typeof arg === 'string' && (arg.includes('test cleanup') ||
        arg.includes('jest')))) {
        originalConsoleWarn(...args);
    }
};
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    // Only log if it's not a test-related rejection
    if (!reason || (typeof reason === 'string' && !reason.includes('test'))) {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    }
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    // Only log if it's not a test-related exception
    if (!error.message || !error.message.includes('test')) {
        console.error('Uncaught Exception:', error);
    }
});
//# sourceMappingURL=test-setup.js.map