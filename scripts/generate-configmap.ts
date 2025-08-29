#!/usr/bin/env ts-node

import { program } from 'commander';
import { ConfigurationManager } from '../config/config-manager';

interface GenerateOptions {
  environment: string;
  service: string;
  configPath: string;
  output?: string;
}

async function generateConfigMap(options: GenerateOptions): Promise<void> {
  const configManager = new ConfigurationManager(options.configPath);

  try {
    // Load environment configuration
    const config = await configManager.loadEnvironmentConfig(options.environment);
    
    // Generate ConfigMap YAML
    const configMapYaml = configManager.generateConfigMap(config, options.service);
    
    if (options.output) {
      const fs = require('fs');
      fs.writeFileSync(options.output, configMapYaml);
      console.log(`ConfigMap written to: ${options.output}`);
    } else {
      // Output to stdout for piping to kubectl
      console.log(configMapYaml);
    }

  } catch (error) {
    console.error('Error generating ConfigMap:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function main() {
  program
    .name('generate-configmap')
    .description('Generate Kubernetes ConfigMap from environment configuration')
    .version('1.0.0');

  program
    .requiredOption('-e, --environment <env>', 'Environment (development, staging, production)')
    .requiredOption('-s, --service <service>', 'Service name')
    .option('-c, --config-path <path>', 'Path to configuration directory', './config')
    .option('-o, --output <file>', 'Output file (default: stdout)');

  program.parse();

  const options = program.opts() as GenerateOptions;
  await generateConfigMap(options);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}