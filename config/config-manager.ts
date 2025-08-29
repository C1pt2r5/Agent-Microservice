import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Joi from 'joi';
import { createHash } from 'crypto';

export interface EnvironmentConfig {
  environment: string;
  version: string;
  global: GlobalConfig;
  agents: AgentsConfig;
  infrastructure: InfrastructureConfig;
  external_services?: ExternalServicesConfig;
  monitoring?: MonitoringConfig;
  security?: SecurityConfig;
  scaling?: ScalingConfig;
  backup?: BackupConfig;
  disaster_recovery?: DisasterRecoveryConfig;
  features?: FeaturesConfig;
  compliance?: ComplianceConfig;
}

export interface GlobalConfig {
  project_id: string;
  region: string;
  cluster_name: string;
  namespace: string;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  metrics_enabled: boolean;
  tracing_enabled: boolean;
}

export interface AgentConfig {
  enabled: boolean;
  replicas: number;
  image: string;
  port: number;
  resources: ResourceConfig;
  environment: Record<string, string>;
  health_check: HealthCheckConfig;
}

export interface AgentsConfig {
  chatbot: AgentConfig;
  fraud_detection: AgentConfig;
  recommendation: AgentConfig;
}

export interface InfrastructureServiceConfig {
  enabled: boolean;
  replicas: number;
  image: string;
  port: number;
  resources: ResourceConfig;
  environment: Record<string, string>;
  services?: Record<string, ServiceEndpointConfig>;
}

export interface InfrastructureConfig {
  mcp_gateway: InfrastructureServiceConfig;
  a2a_hub: InfrastructureServiceConfig;
  adk: InfrastructureServiceConfig;
}

export interface ResourceConfig {
  requests: {
    memory: string;
    cpu: string;
  };
  limits: {
    memory: string;
    cpu: string;
  };
}

export interface HealthCheckConfig {
  path: string;
  initial_delay: number;
  period: number;
  timeout: number;
  failure_threshold: number;
}

export interface ServiceEndpointConfig {
  endpoint: string;
  auth_type: 'bearer' | 'api-key' | 'oauth2' | 'none';
  rate_limit_rpm: number;
  timeout: number;
  circuit_breaker: {
    failure_threshold: number;
    recovery_timeout: number;
    half_open_max_calls: number;
  };
}

export interface ExternalServicesConfig {
  redis?: {
    enabled: boolean;
    host: string;
    port: number;
    database: number;
    password_secret: string;
    connection_pool: {
      min: number;
      max: number;
      idle_timeout: number;
    };
  };
  gemini?: {
    endpoint: string;
    model: string;
    api_key_secret: string;
    rate_limit: number;
    timeout: number;
    retry: {
      max_attempts: number;
      initial_delay: number;
      max_delay: number;
    };
  };
}

export interface MonitoringConfig {
  prometheus?: {
    enabled: boolean;
    port: number;
    scrape_interval: string;
    retention: string;
  };
  grafana?: {
    enabled: boolean;
    port: number;
    admin_password_secret: string;
  };
  jaeger?: {
    enabled: boolean;
    collector_port: number;
    query_port: number;
    sampling_rate: number;
  };
}

export interface SecurityConfig {
  tls?: {
    enabled: boolean;
    cert_manager?: boolean;
    min_tls_version?: string;
  };
  network_policies?: {
    enabled: boolean;
    default_deny?: boolean;
  };
  pod_security?: {
    enabled: boolean;
    policy?: string;
    enforce?: boolean;
  };
  secrets?: {
    encryption_at_rest: boolean;
    rotation_enabled?: boolean;
  };
}

export interface ScalingConfig {
  horizontal_pod_autoscaler?: {
    enabled: boolean;
    min_replicas: number;
    max_replicas: number;
    target_cpu_utilization: number;
    target_memory_utilization: number;
    scale_down_stabilization?: number;
    scale_up_stabilization?: number;
  };
  vertical_pod_autoscaler?: {
    enabled: boolean;
    update_mode: string;
    resource_policy?: string;
  };
}

export interface BackupConfig {
  enabled: boolean;
  schedule?: string;
  retention_days?: number;
  storage_class?: string;
  cross_region_replication?: boolean;
}

export interface DisasterRecoveryConfig {
  enabled: boolean;
  rpo: number;
  rto: number;
  backup_regions: string[];
}

export interface FeaturesConfig {
  experimental_features: boolean;
  debug_mode: boolean;
  performance_profiling: boolean;
  detailed_logging: boolean;
  maintenance_mode?: boolean;
}

export interface ComplianceConfig {
  data_retention_days: number;
  audit_logging: boolean;
  encryption_in_transit: boolean;
  encryption_at_rest: boolean;
  access_logging: boolean;
}

export interface SecretConfig {
  name: string;
  type: 'generic' | 'tls' | 'docker-registry';
  data: Record<string, string>;
  encrypted?: boolean;
}

export class ConfigurationManager {
  private configCache: Map<string, EnvironmentConfig> = new Map();
  private secretsCache: Map<string, SecretConfig> = new Map();
  private configDir: string;
  private secretsDir: string;
  private schemasDir: string;

  constructor(baseDir: string = './config') {
    this.configDir = path.join(baseDir, 'environments');
    this.secretsDir = path.join(baseDir, 'secrets');
    this.schemasDir = path.join(baseDir, 'schemas');
  }

  /**
   * Load configuration for a specific environment
   */
  async loadEnvironmentConfig(environment: string): Promise<EnvironmentConfig> {
    const cacheKey = `env_${environment}`;
    
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    const configPath = path.join(this.configDir, `${environment}.yaml`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent) as EnvironmentConfig;
      
      // Validate configuration
      await this.validateConfiguration(config);
      
      // Cache the configuration
      this.configCache.set(cacheKey, config);
      
      console.log(`Loaded configuration for environment: ${environment}`);
      return config;
      
    } catch (error) {
      throw new Error(`Failed to load configuration for ${environment}: ${error}`);
    }
  }

  /**
   * Validate configuration against schema
   */
  async validateConfiguration(config: EnvironmentConfig): Promise<void> {
    const schema = this.getValidationSchema();
    
    const { error } = schema.validate(config, { 
      abortEarly: false,
      allowUnknown: false 
    });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message).join(', ');
      throw new Error(`Configuration validation failed: ${errorMessages}`);
    }
  }

  /**
   * Load secrets for a specific environment
   */
  async loadSecrets(environment: string): Promise<Map<string, SecretConfig>> {
    const cacheKey = `secrets_${environment}`;
    
    if (this.secretsCache.has(cacheKey)) {
      return new Map([[cacheKey, this.secretsCache.get(cacheKey)!]]);
    }

    const secretsPath = path.join(this.secretsDir, `${environment}.yaml`);
    
    if (!fs.existsSync(secretsPath)) {
      console.warn(`Secrets file not found: ${secretsPath}`);
      return new Map();
    }

    try {
      const secretsContent = fs.readFileSync(secretsPath, 'utf8');
      const secrets = yaml.load(secretsContent) as { secrets: SecretConfig[] };
      
      const secretsMap = new Map<string, SecretConfig>();
      
      if (secrets.secrets) {
        for (const secret of secrets.secrets) {
          secretsMap.set(secret.name, secret);
          this.secretsCache.set(`${cacheKey}_${secret.name}`, secret);
        }
      }
      
      console.log(`Loaded ${secretsMap.size} secrets for environment: ${environment}`);
      return secretsMap;
      
    } catch (error) {
      throw new Error(`Failed to load secrets for ${environment}: ${error}`);
    }
  }

  /**
   * Generate environment variables from configuration
   */
  generateEnvironmentVariables(config: EnvironmentConfig, serviceName: string): Record<string, string> {
    const envVars: Record<string, string> = {};
    
    // Global environment variables
    envVars.NODE_ENV = config.environment;
    envVars.LOG_LEVEL = config.global.log_level;
    envVars.PROJECT_ID = config.global.project_id;
    envVars.REGION = config.global.region;
    envVars.CLUSTER_NAME = config.global.cluster_name;
    envVars.NAMESPACE = config.global.namespace;
    
    // Service-specific environment variables
    const serviceConfig = this.getServiceConfig(config, serviceName);
    if (serviceConfig && serviceConfig.environment) {
      Object.assign(envVars, serviceConfig.environment);
    }
    
    // External services configuration
    if (config.external_services) {
      if (config.external_services.redis) {
        envVars.REDIS_HOST = config.external_services.redis.host;
        envVars.REDIS_PORT = config.external_services.redis.port.toString();
        envVars.REDIS_DATABASE = config.external_services.redis.database.toString();
      }
      
      if (config.external_services.gemini) {
        envVars.GEMINI_ENDPOINT = config.external_services.gemini.endpoint;
        envVars.GEMINI_MODEL = config.external_services.gemini.model;
        envVars.GEMINI_RATE_LIMIT = config.external_services.gemini.rate_limit.toString();
        envVars.GEMINI_TIMEOUT = config.external_services.gemini.timeout.toString();
      }
    }
    
    // Monitoring configuration
    if (config.monitoring) {
      envVars.METRICS_ENABLED = config.global.metrics_enabled.toString();
      envVars.TRACING_ENABLED = config.global.tracing_enabled.toString();
      
      if (config.monitoring.jaeger) {
        envVars.JAEGER_SAMPLING_RATE = config.monitoring.jaeger.sampling_rate.toString();
      }
    }
    
    return envVars;
  }

  /**
   * Generate Kubernetes ConfigMap YAML
   */
  generateConfigMap(config: EnvironmentConfig, serviceName: string): string {
    const envVars = this.generateEnvironmentVariables(config, serviceName);
    
    const configMapData: Record<string, string> = {};
    
    // Convert environment variables to ConfigMap data
    for (const [key, value] of Object.entries(envVars)) {
      configMapData[key] = value;
    }
    
    // Add service-specific configuration files
    const serviceConfig = this.getServiceConfig(config, serviceName);
    if (serviceConfig) {
      configMapData[`${serviceName}-config.yaml`] = yaml.dump(serviceConfig);
    }
    
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${serviceName}-config`,
        namespace: config.global.namespace,
        labels: {
          app: serviceName,
          environment: config.environment,
          version: config.version
        }
      },
      data: configMapData
    };
    
    return yaml.dump(configMap);
  }

  /**
   * Generate Kubernetes Secret YAML
   */
  generateSecret(secretConfig: SecretConfig, namespace: string): string {
    const secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: secretConfig.name,
        namespace: namespace
      },
      type: this.getSecretType(secretConfig.type),
      data: this.encodeSecretData(secretConfig.data)
    };
    
    return yaml.dump(secret);
  }

  /**
   * Encrypt sensitive configuration data
   */
  encryptSecretData(data: Record<string, string>, key: string): Record<string, string> {
    const encrypted: Record<string, string> = {};
    
    for (const [k, v] of Object.entries(data)) {
      const cipher = createHash('sha256').update(key).digest();
      // In a real implementation, use proper encryption like AES
      encrypted[k] = Buffer.from(v).toString('base64');
    }
    
    return encrypted;
  }

  /**
   * Decrypt sensitive configuration data
   */
  decryptSecretData(encryptedData: Record<string, string>, key: string): Record<string, string> {
    const decrypted: Record<string, string> = {};
    
    for (const [k, v] of Object.entries(encryptedData)) {
      // In a real implementation, use proper decryption
      decrypted[k] = Buffer.from(v, 'base64').toString();
    }
    
    return decrypted;
  }

  /**
   * Validate configuration consistency across environments
   */
  async validateConsistency(environments: string[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const configs: EnvironmentConfig[] = [];
    
    // Load all configurations
    for (const env of environments) {
      try {
        const config = await this.loadEnvironmentConfig(env);
        configs.push(config);
      } catch (error) {
        results.push({
          environment: env,
          valid: false,
          errors: [`Failed to load configuration: ${error}`]
        });
      }
    }
    
    // Validate each configuration
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const errors: string[] = [];
      
      try {
        await this.validateConfiguration(config);
        
        // Additional consistency checks
        this.validateResourceLimits(config, errors);
        this.validateServiceEndpoints(config, errors);
        this.validateSecuritySettings(config, errors);
        
        results.push({
          environment: environments[i],
          valid: errors.length === 0,
          errors
        });
        
      } catch (error) {
        results.push({
          environment: environments[i],
          valid: false,
          errors: [error instanceof Error ? error.message : 'Unknown validation error']
        });
      }
    }
    
    return results;
  }

  /**
   * Get configuration checksum for change detection
   */
  getConfigurationChecksum(config: EnvironmentConfig): string {
    const configString = JSON.stringify(config, Object.keys(config).sort());
    return createHash('sha256').update(configString).digest('hex');
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
    this.secretsCache.clear();
  }

  private getServiceConfig(config: EnvironmentConfig, serviceName: string): any {
    // Check agents
    if (config.agents && (config.agents as any)[serviceName]) {
      return (config.agents as any)[serviceName];
    }
    
    // Check infrastructure services
    if (config.infrastructure && (config.infrastructure as any)[serviceName]) {
      return (config.infrastructure as any)[serviceName];
    }
    
    return null;
  }

  private getValidationSchema(): Joi.ObjectSchema {
    return Joi.object({
      environment: Joi.string().valid('development', 'staging', 'production').required(),
      version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
      global: Joi.object({
        project_id: Joi.string().pattern(/^[a-z][a-z0-9-]*[a-z0-9]$/).required(),
        region: Joi.string().pattern(/^[a-z]+-[a-z]+\d+$/).required(),
        cluster_name: Joi.string().min(1).max(40).required(),
        namespace: Joi.string().pattern(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/).required(),
        log_level: Joi.string().valid('debug', 'info', 'warn', 'error').required(),
        metrics_enabled: Joi.boolean().required(),
        tracing_enabled: Joi.boolean().required()
      }).required(),
      agents: Joi.object().required(),
      infrastructure: Joi.object().required(),
      external_services: Joi.object().optional(),
      monitoring: Joi.object().optional(),
      security: Joi.object().optional(),
      scaling: Joi.object().optional(),
      backup: Joi.object().optional(),
      disaster_recovery: Joi.object().optional(),
      features: Joi.object().optional(),
      compliance: Joi.object().optional()
    });
  }

  private getSecretType(type: string): string {
    switch (type) {
      case 'tls':
        return 'kubernetes.io/tls';
      case 'docker-registry':
        return 'kubernetes.io/dockerconfigjson';
      default:
        return 'Opaque';
    }
  }

  private encodeSecretData(data: Record<string, string>): Record<string, string> {
    const encoded: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(data)) {
      encoded[key] = Buffer.from(value).toString('base64');
    }
    
    return encoded;
  }

  private validateResourceLimits(config: EnvironmentConfig, errors: string[]): void {
    const services = [...Object.values(config.agents), ...Object.values(config.infrastructure)];
    
    for (const service of services) {
      if (service.resources) {
        const requestMemory = this.parseMemory(service.resources.requests.memory);
        const limitMemory = this.parseMemory(service.resources.limits.memory);
        
        if (requestMemory > limitMemory) {
          errors.push(`Resource request memory (${service.resources.requests.memory}) exceeds limit (${service.resources.limits.memory})`);
        }
        
        const requestCpu = this.parseCpu(service.resources.requests.cpu);
        const limitCpu = this.parseCpu(service.resources.limits.cpu);
        
        if (requestCpu > limitCpu) {
          errors.push(`Resource request CPU (${service.resources.requests.cpu}) exceeds limit (${service.resources.limits.cpu})`);
        }
      }
    }
  }

  private validateServiceEndpoints(config: EnvironmentConfig, errors: string[]): void {
    if (config.infrastructure.mcp_gateway.services) {
      for (const [serviceName, serviceConfig] of Object.entries(config.infrastructure.mcp_gateway.services)) {
        try {
          new URL(serviceConfig.endpoint);
        } catch {
          errors.push(`Invalid endpoint URL for service ${serviceName}: ${serviceConfig.endpoint}`);
        }
      }
    }
  }

  private validateSecuritySettings(config: EnvironmentConfig, errors: string[]): void {
    if (config.environment === 'production') {
      if (!config.security?.tls?.enabled) {
        errors.push('TLS must be enabled in production environment');
      }
      
      if (!config.security?.secrets?.encryption_at_rest) {
        errors.push('Secret encryption at rest must be enabled in production environment');
      }
      
      if (config.features?.debug_mode) {
        errors.push('Debug mode must be disabled in production environment');
      }
    }
  }

  private parseMemory(memory: string): number {
    const match = memory.match(/^(\d+)(Mi|Gi)$/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    return unit === 'Gi' ? value * 1024 : value;
  }

  private parseCpu(cpu: string): number {
    if (cpu.endsWith('m')) {
      return parseInt(cpu.slice(0, -1));
    }
    return parseFloat(cpu) * 1000;
  }
}

export interface ValidationResult {
  environment: string;
  valid: boolean;
  errors: string[];
}

// Export singleton instance
export const configManager = new ConfigurationManager();