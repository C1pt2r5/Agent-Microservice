#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { program } from 'commander';
import { ConfigurationManager, ValidationResult } from '../config/config-manager';

interface ValidationOptions {
  environment: string;
  configPath: string;
  verbose: boolean;
  checkConsistency: boolean;
  environments: string[];
}

class ConfigValidator {
  private configManager: ConfigurationManager;

  constructor(configPath: string) {
    this.configManager = new ConfigurationManager(configPath);
  }

  async validateSingleEnvironment(environment: string, verbose: boolean = false): Promise<boolean> {
    console.log(`\n🔍 Validating configuration for environment: ${environment}`);
    console.log('='.repeat(60));

    try {
      // Load and validate configuration
      const config = await this.configManager.loadEnvironmentConfig(environment);
      
      if (verbose) {
        console.log(`✓ Configuration loaded successfully`);
        console.log(`  - Project ID: ${config.global.project_id}`);
        console.log(`  - Region: ${config.global.region}`);
        console.log(`  - Namespace: ${config.global.namespace}`);
        console.log(`  - Log Level: ${config.global.log_level}`);
      }

      // Validate configuration structure
      await this.configManager.validateConfiguration(config);
      console.log(`✓ Configuration structure is valid`);

      // Check resource configurations
      this.validateResources(config, verbose);

      // Check service configurations
      this.validateServices(config, verbose);

      // Check security settings
      this.validateSecurity(config, environment, verbose);

      // Check scaling configurations
      this.validateScaling(config, verbose);

      // Load and validate secrets
      try {
        const secrets = await this.configManager.loadSecrets(environment);
        console.log(`✓ Secrets loaded successfully (${secrets.size} secret(s))`);
        
        if (verbose && secrets.size > 0) {
          console.log(`  Secret names: ${Array.from(secrets.keys()).join(', ')}`);
        }
      } catch (error) {
        console.log(`⚠ Warning: Could not load secrets - ${error}`);
      }

      console.log(`\n✅ Environment '${environment}' validation passed!`);
      return true;

    } catch (error) {
      console.error(`\n❌ Environment '${environment}' validation failed:`);
      console.error(`   ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  async validateConsistency(environments: string[], verbose: boolean = false): Promise<boolean> {
    console.log(`\n🔍 Validating consistency across environments: ${environments.join(', ')}`);
    console.log('='.repeat(60));

    try {
      const results = await this.configManager.validateConsistency(environments);
      
      let allValid = true;
      for (const result of results) {
        if (result.valid) {
          console.log(`✓ ${result.environment}: Valid`);
        } else {
          console.log(`❌ ${result.environment}: Invalid`);
          if (verbose) {
            result.errors.forEach(error => console.log(`   - ${error}`));
          }
          allValid = false;
        }
      }

      if (allValid) {
        console.log(`\n✅ All environments are consistent!`);
      } else {
        console.log(`\n❌ Environment consistency validation failed!`);
      }

      return allValid;

    } catch (error) {
      console.error(`\n❌ Consistency validation failed:`);
      console.error(`   ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  private validateResources(config: any, verbose: boolean): void {
    const services = [
      ...Object.entries(config.agents || {}),
      ...Object.entries(config.infrastructure || {})
    ];

    for (const [serviceName, serviceConfig] of services) {
      if (serviceConfig && typeof serviceConfig === 'object' && serviceConfig.resources) {
        const resources = serviceConfig.resources;
        
        // Validate memory limits
        const requestMemory = this.parseMemory(resources.requests?.memory);
        const limitMemory = this.parseMemory(resources.limits?.memory);
        
        if (requestMemory > limitMemory) {
          throw new Error(`${serviceName}: Memory request (${resources.requests.memory}) exceeds limit (${resources.limits.memory})`);
        }

        // Validate CPU limits
        const requestCpu = this.parseCpu(resources.requests?.cpu);
        const limitCpu = this.parseCpu(resources.limits?.cpu);
        
        if (requestCpu > limitCpu) {
          throw new Error(`${serviceName}: CPU request (${resources.requests.cpu}) exceeds limit (${resources.limits.cpu})`);
        }

        if (verbose) {
          console.log(`  ✓ ${serviceName}: Resource limits are valid`);
        }
      }
    }

    console.log(`✓ Resource configurations are valid`);
  }

  private validateServices(config: any, verbose: boolean): void {
    // Validate MCP Gateway services
    if (config.infrastructure?.mcp_gateway?.services) {
      const services = config.infrastructure.mcp_gateway.services;
      
      for (const [serviceName, serviceConfig] of Object.entries(services)) {
        if (serviceConfig && typeof serviceConfig === 'object') {
          // Validate endpoint URL
          try {
            new URL(serviceConfig.endpoint);
          } catch {
            throw new Error(`Invalid endpoint URL for service ${serviceName}: ${serviceConfig.endpoint}`);
          }

          // Validate auth type
          const validAuthTypes = ['bearer', 'api-key', 'oauth2', 'none'];
          if (!validAuthTypes.includes(serviceConfig.auth_type)) {
            throw new Error(`Invalid auth type for service ${serviceName}: ${serviceConfig.auth_type}`);
          }

          // Validate rate limits
          if (serviceConfig.rate_limit_rpm <= 0) {
            throw new Error(`Invalid rate limit for service ${serviceName}: ${serviceConfig.rate_limit_rpm}`);
          }

          if (verbose) {
            console.log(`  ✓ ${serviceName}: Service configuration is valid`);
          }
        }
      }
    }

    console.log(`✓ Service configurations are valid`);
  }

  private validateSecurity(config: any, environment: string, verbose: boolean): void {
    const security = config.security || {};

    // Production security requirements
    if (environment === 'production') {
      if (!security.tls?.enabled) {
        throw new Error('TLS must be enabled in production environment');
      }

      if (!security.secrets?.encryption_at_rest) {
        throw new Error('Secret encryption at rest must be enabled in production environment');
      }

      if (config.features?.debug_mode) {
        throw new Error('Debug mode must be disabled in production environment');
      }

      if (config.features?.experimental_features) {
        throw new Error('Experimental features must be disabled in production environment');
      }

      if (verbose) {
        console.log(`  ✓ Production security requirements met`);
      }
    }

    // Staging security requirements
    if (environment === 'staging') {
      if (!security.tls?.enabled) {
        console.log(`  ⚠ Warning: TLS is not enabled in staging environment`);
      }

      if (verbose) {
        console.log(`  ✓ Staging security configuration validated`);
      }
    }

    console.log(`✓ Security configurations are valid for ${environment}`);
  }

  private validateScaling(config: any, verbose: boolean): void {
    const scaling = config.scaling;

    if (scaling?.horizontal_pod_autoscaler?.enabled) {
      const hpa = scaling.horizontal_pod_autoscaler;
      
      if (hpa.min_replicas >= hpa.max_replicas) {
        throw new Error(`HPA min_replicas (${hpa.min_replicas}) must be less than max_replicas (${hpa.max_replicas})`);
      }

      if (hpa.target_cpu_utilization <= 0 || hpa.target_cpu_utilization > 100) {
        throw new Error(`HPA target_cpu_utilization must be between 1 and 100, got: ${hpa.target_cpu_utilization}`);
      }

      if (hpa.target_memory_utilization <= 0 || hpa.target_memory_utilization > 100) {
        throw new Error(`HPA target_memory_utilization must be between 1 and 100, got: ${hpa.target_memory_utilization}`);
      }

      if (verbose) {
        console.log(`  ✓ HPA configuration is valid`);
      }
    }

    console.log(`✓ Scaling configurations are valid`);
  }

  private parseMemory(memory: string): number {
    if (!memory) return 0;
    
    const match = memory.match(/^(\d+)(Mi|Gi)$/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    return unit === 'Gi' ? value * 1024 : value;
  }

  private parseCpu(cpu: string): number {
    if (!cpu) return 0;
    
    if (cpu.endsWith('m')) {
      return parseInt(cpu.slice(0, -1));
    }
    return parseFloat(cpu) * 1000;
  }
}

async function main() {
  program
    .name('validate-config')
    .description('Validate environment configuration files')
    .version('1.0.0');

  program
    .option('-e, --environment <env>', 'Environment to validate (development, staging, production)')
    .option('-c, --config-path <path>', 'Path to configuration directory', './config')
    .option('-v, --verbose', 'Verbose output', false)
    .option('--check-consistency', 'Check consistency across all environments', false)
    .option('--environments <envs>', 'Comma-separated list of environments for consistency check', 'development,staging,production');

  program.parse();

  const options = program.opts() as ValidationOptions;

  if (!options.environment && !options.checkConsistency) {
    console.error('❌ Error: Either --environment or --check-consistency must be specified');
    process.exit(1);
  }

  const validator = new ConfigValidator(options.configPath);
  let success = true;

  try {
    if (options.checkConsistency) {
      const environments = options.environments.split(',').map(env => env.trim());
      success = await validator.validateConsistency(environments, options.verbose);
    } else {
      success = await validator.validateSingleEnvironment(options.environment, options.verbose);
    }

    if (success) {
      console.log('\n🎉 All validations passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Validation failed!');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Validation error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export { ConfigValidator };