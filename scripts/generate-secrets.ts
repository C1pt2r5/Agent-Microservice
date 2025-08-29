#!/usr/bin/env ts-node

import { program } from 'commander';
import { ConfigurationManager } from '../config/config-manager';

interface GenerateOptions {
  environment: string;
  configPath: string;
  encryptionKey?: string;
  output?: string;
}

async function generateSecrets(options: GenerateOptions): Promise<void> {
  const configManager = new ConfigurationManager(options.configPath);

  try {
    // Load environment configuration
    const config = await configManager.loadEnvironmentConfig(options.environment);
    
    // Load secrets
    const secrets = await configManager.loadSecrets(options.environment);
    
    if (secrets.size === 0) {
      console.error('No secrets found for environment:', options.environment);
      process.exit(1);
    }

    let allSecretsYaml = '';
    
    // Generate Secret YAML for each secret
    for (const [secretName, secretConfig] of secrets) {
      // Decrypt secrets if they are encrypted
      let secretData = secretConfig.data;
      if (secretConfig.encrypted && options.encryptionKey) {
        secretData = configManager.decryptSecretData(secretConfig.data, options.encryptionKey);
      } else if (secretConfig.encrypted && !options.encryptionKey) {
        console.error(`Secret '${secretName}' is encrypted but no encryption key provided`);
        process.exit(1);
      }

      const updatedSecretConfig = {
        ...secretConfig,
        data: secretData
      };

      const secretYaml = configManager.generateSecret(updatedSecretConfig, config.global.namespace);
      allSecretsYaml += secretYaml + '\n---\n';
    }
    
    // Remove trailing separator
    allSecretsYaml = allSecretsYaml.replace(/\n---\n$/, '');
    
    if (options.output) {
      const fs = require('fs');
      fs.writeFileSync(options.output, allSecretsYaml);
      console.log(`Secrets written to: ${options.output}`);
    } else {
      // Output to stdout for piping to kubectl
      console.log(allSecretsYaml);
    }

  } catch (error) {
    console.error('Error generating Secrets:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function main() {
  program
    .name('generate-secrets')
    .description('Generate Kubernetes Secrets from environment configuration')
    .version('1.0.0');

  program
    .requiredOption('-e, --environment <env>', 'Environment (development, staging, production)')
    .option('-c, --config-path <path>', 'Path to configuration directory', './config')
    .option('-k, --encryption-key <key>', 'Encryption key for encrypted secrets')
    .option('-o, --output <file>', 'Output file (default: stdout)');

  program.parse();

  const options = program.opts() as GenerateOptions;
  await generateSecrets(options);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}