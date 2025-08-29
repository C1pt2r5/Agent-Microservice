/**
 * Custom Jest test sequencer for optimized test execution
 * Runs simpler tests first, complex integration tests last
 */

const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    const copyTests = Array.from(tests);

    // Define test priority order (lower number = higher priority)
    const getTestPriority = (testPath) => {
      const path = testPath.path;

      // Unit tests first (highest priority)
      if (path.includes('__tests__/base-agent.test.ts')) return 1;
      if (path.includes('__tests__/agent-factory.test.ts')) return 2;
      if (path.includes('infrastructure/monitoring/__tests__')) return 3;
      if (path.includes('integration/gemini/__tests__')) return 4;

      // Agent tests (medium priority)
      if (path.includes('agents/chatbot/__tests__')) return 5;
      if (path.includes('agents/recommendation/__tests__')) return 6;
      if (path.includes('agents/fraud-detection/__tests__')) return 7;

      // Service tests (lower priority - more complex)
      if (path.includes('__tests__/chatbot-service.test.ts')) return 8;
      if (path.includes('__tests__/fraud-detection-service.test.ts')) return 9;
      if (path.includes('__tests__/recommendation-service.test.ts')) return 10;

      // Integration tests last (lowest priority - most complex)
      if (path.includes('integration/')) return 11;
      if (path.includes('k8s/')) return 12;

      // Default priority
      return 13;
    };

    // Sort by priority, then by path for consistent ordering
    return copyTests.sort((testA, testB) => {
      const priorityA = getTestPriority(testA);
      const priorityB = getTestPriority(testB);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, sort alphabetically for consistency
      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = CustomSequencer;