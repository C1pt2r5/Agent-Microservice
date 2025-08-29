module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/k8s'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts', '**/?(*.)+(spec|test).js'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Enhanced cleanup and resource management
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testTimeout: 10000, // Optimized timeout for complex scenarios
  forceExit: true,
  detectOpenHandles: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Use fake timers to prevent real timer issues
  timers: 'fake',
  // Performance optimizations
  maxWorkers: '50%', // Use 50% of available cores
  cache: true, // Enable Jest cache
  // Better async handling
  testEnvironmentOptions: {
    // Disable experimental features that might cause issues
    disableExperimentalModules: true,
  },
  // Optimize for complex test scenarios
  testSequencer: '<rootDir>/src/test-sequencer.js',
};