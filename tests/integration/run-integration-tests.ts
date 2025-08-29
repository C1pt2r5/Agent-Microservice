#!/usr/bin/env ts-node

import { runAllIntegrationTests } from './example-tests';

// Main execution
async function main() {
  console.log('Starting Integration Test Framework...');
  console.log('=====================================');
  
  try {
    await runAllIntegrationTests();
    console.log('\n✅ All integration tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Integration tests failed:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Integration tests interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Integration tests terminated');
  process.exit(143);
});

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { main as runIntegrationTests };