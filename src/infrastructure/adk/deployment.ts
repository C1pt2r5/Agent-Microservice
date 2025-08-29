/**
 * Agent Development Kit (ADK) - Deployment Automation
 * Provides tools for Kubernetes manifest generation, Docker containerization, and deployment pipelines
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  agentName: string;
  namespace: string;
  image: {
    registry: string;
    repository: string;
    tag: string;
    pullPolicy: 'Always' | 'IfNotPresent' | 'Never';
  };
  resources: {
    requests: {
      cpu: string;
      memory: string;
    };
    limits: {
      cpu: string;
      memory: string;
    };
  };
  replicas: number;
  service: {
    type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
    port: number;
    targetPort: number;
  };
  ingress?: {
    enabled: boolean;
    host: string;
    path: string;
    tls?: boolean;
  };
  environment: Record<string, string>;
  secrets?: Record<string, string>;
  configMaps?: Record<string, string>;
  volumes?: VolumeConfig[];
  healthCheck: {
    enabled: boolean;
    path: string;
    initialDelaySeconds: number;
    periodSeconds: number;
  };
  autoscaling?: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilizationPercentage: number;
  };
}

export interface VolumeConfig {
  name: string;
  type: 'emptyDir' | 'configMap' | 'secret' | 'persistentVolumeClaim';
  mountPath: string;
  source?: string;
}

export interface DockerConfig {
  baseImage: string;
  workDir: string;
  port: number;
  buildArgs?: Record<string, string>;
  labels?: Record<string, string>;
  healthCheck?: {
    command: string;
    interval: string;
    timeout: string;
    retries: number;
  };
}

export interface DeploymentResult {
  success: boolean;
  manifests: GeneratedManifest[];
  dockerfile?: string;
  errors: string[];
  warnings: string[];
  summary: {
    totalManifests: number;
    totalSize: number;
    processingTime: number;
  };
}

export interface GeneratedManifest {
  kind: string;
  name: string;
  content: string;
  filePath: string;
}

export interface PipelineConfig {
  provider: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'azure-devops';
  stages: PipelineStage[];
  triggers: {
    branches: string[];
    tags?: string[];
    pullRequests?: boolean;
  };
  environment: Record<string, string>;
}

export interface PipelineStage {
  name: string;
  steps: PipelineStep[];
  condition?: string;
  environment?: Record<string, string>;
}

export interface PipelineStep {
  name: string;
  action: string;
  parameters: Record<string, any>;
}

export class DeploymentAutomation extends EventEmitter {
  private outputPath: string;

  constructor(outputPath: string = './k8s') {
    super();
    this.outputPath = outputPath;
  }

  /**
   * Generate complete deployment package
   */
  async generateDeployment(
    config: DeploymentConfig,
    dockerConfig?: DockerConfig,
    pipelineConfig?: PipelineConfig
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    const result: DeploymentResult = {
      success: false,
      manifests: [],
      errors: [],
      warnings: [],
      summary: {
        totalManifests: 0,
        totalSize: 0,
        processingTime: 0
      }
    };

    try {
      this.emit('deploymentStarted', config);

      // Validate configuration
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        result.errors.push(...validation.errors);
        return result;
      }

      // Ensure output directory exists
      await this.ensureDirectory(this.outputPath);

      // Generate Kubernetes manifests
      const manifests = await this.generateKubernetesManifests(config);
      result.manifests.push(...manifests);

      // Generate Dockerfile if Docker config provided
      if (dockerConfig) {
        const dockerfile = await this.generateDockerfile(config, dockerConfig);
        result.dockerfile = dockerfile;
      }

      // Generate CI/CD pipeline if config provided
      if (pipelineConfig) {
        await this.generatePipeline(config, pipelineConfig);
      }

      // Write manifests to files
      for (const manifest of result.manifests) {
        const filePath = path.join(this.outputPath, manifest.filePath);
        await this.ensureDirectory(path.dirname(filePath));
        await fs.writeFile(filePath, manifest.content);
        result.summary.totalSize += manifest.content.length;
      }

      // Generate deployment scripts
      await this.generateDeploymentScripts(config);

      result.summary.totalManifests = result.manifests.length;
      result.summary.processingTime = Date.now() - startTime;
      result.success = true;

      this.emit('deploymentCompleted', { config, result });

      return result;

    } catch (error) {
      result.errors.push(`Deployment generation failed: ${error}`);
      result.summary.processingTime = Date.now() - startTime;
      
      this.emit('deploymentError', { config, error });
      return result;
    }
  }

  /**
   * Generate Kubernetes manifests
   */
  async generateKubernetesManifests(config: DeploymentConfig): Promise<GeneratedManifest[]> {
    const manifests: GeneratedManifest[] = [];

    // Generate Namespace
    manifests.push({
      kind: 'Namespace',
      name: config.namespace,
      content: this.generateNamespaceManifest(config),
      filePath: `${config.agentName}-namespace.yaml`
    });

    // Generate Deployment
    manifests.push({
      kind: 'Deployment',
      name: config.agentName,
      content: this.generateDeploymentManifest(config),
      filePath: `${config.agentName}-deployment.yaml`
    });

    // Generate Service
    manifests.push({
      kind: 'Service',
      name: `${config.agentName}-service`,
      content: this.generateServiceManifest(config),
      filePath: `${config.agentName}-service.yaml`
    });

    // Generate ConfigMap if needed
    if (config.configMaps && Object.keys(config.configMaps).length > 0) {
      manifests.push({
        kind: 'ConfigMap',
        name: `${config.agentName}-config`,
        content: this.generateConfigMapManifest(config),
        filePath: `${config.agentName}-configmap.yaml`
      });
    }

    // Generate Secret if needed
    if (config.secrets && Object.keys(config.secrets).length > 0) {
      manifests.push({
        kind: 'Secret',
        name: `${config.agentName}-secret`,
        content: this.generateSecretManifest(config),
        filePath: `${config.agentName}-secret.yaml`
      });
    }

    // Generate Ingress if enabled
    if (config.ingress?.enabled) {
      manifests.push({
        kind: 'Ingress',
        name: `${config.agentName}-ingress`,
        content: this.generateIngressManifest(config),
        filePath: `${config.agentName}-ingress.yaml`
      });
    }

    // Generate HorizontalPodAutoscaler if enabled
    if (config.autoscaling?.enabled) {
      manifests.push({
        kind: 'HorizontalPodAutoscaler',
        name: `${config.agentName}-hpa`,
        content: this.generateHPAManifest(config),
        filePath: `${config.agentName}-hpa.yaml`
      });
    }

    return manifests;
  }

  /**
   * Generate Dockerfile
   */
  async generateDockerfile(config: DeploymentConfig, dockerConfig: DockerConfig): Promise<string> {
    const dockerfile = `# Multi-stage build for ${config.agentName}
FROM node:18-alpine AS builder

WORKDIR ${dockerConfig.workDir}

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR ${dockerConfig.workDir}

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs ${dockerConfig.workDir}/dist ./dist
COPY --from=builder --chown=nodejs:nodejs ${dockerConfig.workDir}/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs ${dockerConfig.workDir}/package*.json ./

# Set labels
${Object.entries(dockerConfig.labels || {}).map(([key, value]) => 
  `LABEL ${key}="${value}"`
).join('\n')}

# Expose port
EXPOSE ${dockerConfig.port}

# Health check
${dockerConfig.healthCheck ? `HEALTHCHECK --interval=${dockerConfig.healthCheck.interval} \\
  --timeout=${dockerConfig.healthCheck.timeout} \\
  --retries=${dockerConfig.healthCheck.retries} \\
  CMD ${dockerConfig.healthCheck.command}` : ''}

# Switch to non-root user
USER nodejs

# Start the application
CMD ["node", "dist/index.js"]`;

    // Write Dockerfile
    const dockerfilePath = path.join(this.outputPath, '..', 'Dockerfile');
    await fs.writeFile(dockerfilePath, dockerfile);

    return dockerfile;
  }

  /**
   * Generate CI/CD pipeline
   */
  async generatePipeline(config: DeploymentConfig, pipelineConfig: PipelineConfig): Promise<void> {
    switch (pipelineConfig.provider) {
      case 'github-actions':
        await this.generateGitHubActionsPipeline(config, pipelineConfig);
        break;
      case 'gitlab-ci':
        await this.generateGitLabCIPipeline(config, pipelineConfig);
        break;
      case 'jenkins':
        await this.generateJenkinsPipeline(config, pipelineConfig);
        break;
      case 'azure-devops':
        await this.generateAzureDevOpsPipeline(config, pipelineConfig);
        break;
    }
  }

  /**
   * Deploy to Kubernetes cluster
   */
  async deployToCluster(
    config: DeploymentConfig,
    options: {
      kubeconfig?: string;
      context?: string;
      dryRun?: boolean;
      force?: boolean;
    } = {}
  ): Promise<{ success: boolean; output: string; errors: string[] }> {
    const errors: string[] = [];
    let output = '';

    try {
      // Build kubectl command
      let kubectlCmd = 'kubectl';
      
      if (options.kubeconfig) {
        kubectlCmd += ` --kubeconfig=${options.kubeconfig}`;
      }
      
      if (options.context) {
        kubectlCmd += ` --context=${options.context}`;
      }

      // Apply manifests
      const manifestFiles = await this.getManifestFiles(config);
      
      for (const file of manifestFiles) {
        let applyCmd = `${kubectlCmd} apply -f ${file}`;
        
        if (options.dryRun) {
          applyCmd += ' --dry-run=client';
        }
        
        if (options.force) {
          applyCmd += ' --force';
        }

        const { stdout, stderr } = await execAsync(applyCmd);
        output += stdout;
        
        if (stderr) {
          errors.push(stderr);
        }
      }

      // Wait for deployment to be ready
      if (!options.dryRun) {
        const rolloutCmd = `${kubectlCmd} rollout status deployment/${config.agentName} -n ${config.namespace}`;
        const { stdout } = await execAsync(rolloutCmd);
        output += stdout;
      }

      return {
        success: errors.length === 0,
        output,
        errors
      };

    } catch (error) {
      errors.push(`Deployment failed: ${error}`);
      return {
        success: false,
        output,
        errors
      };
    }
  }

  /**
   * Build and push Docker image
   */
  async buildAndPushImage(
    config: DeploymentConfig,
    options: {
      buildContext?: string;
      dockerfile?: string;
      push?: boolean;
      registry?: string;
    } = {}
  ): Promise<{ success: boolean; imageTag: string; output: string; errors: string[] }> {
    const errors: string[] = [];
    let output = '';
    const imageTag = `${config.image.registry}/${config.image.repository}:${config.image.tag}`;

    try {
      const buildContext = options.buildContext || '.';
      const dockerfile = options.dockerfile || 'Dockerfile';

      // Build image
      const buildCmd = `docker build -t ${imageTag} -f ${dockerfile} ${buildContext}`;
      const { stdout: buildOutput, stderr: buildError } = await execAsync(buildCmd);
      
      output += buildOutput;
      if (buildError) {
        errors.push(buildError);
      }

      // Push image if requested
      if (options.push && errors.length === 0) {
        const pushCmd = `docker push ${imageTag}`;
        const { stdout: pushOutput, stderr: pushError } = await execAsync(pushCmd);
        
        output += pushOutput;
        if (pushError) {
          errors.push(pushError);
        }
      }

      return {
        success: errors.length === 0,
        imageTag,
        output,
        errors
      };

    } catch (error) {
      errors.push(`Image build failed: ${error}`);
      return {
        success: false,
        imageTag,
        output,
        errors
      };
    }
  }

  // Private helper methods for generating manifests

  private generateNamespaceManifest(config: DeploymentConfig): string {
    return `apiVersion: v1
kind: Namespace
metadata:
  name: ${config.namespace}
  labels:
    app: ${config.agentName}
    managed-by: adk`;
  }

  private generateDeploymentManifest(config: DeploymentConfig): string {
    const envVars = Object.entries(config.environment).map(([key, value]) => 
      `        - name: ${key}\n          value: "${value}"`
    ).join('\n');

    const volumeMounts = config.volumes?.map(vol => 
      `        - name: ${vol.name}\n          mountPath: ${vol.mountPath}`
    ).join('\n') || '';

    const volumes = config.volumes?.map(vol => {
      switch (vol.type) {
        case 'configMap':
          return `      - name: ${vol.name}\n        configMap:\n          name: ${vol.source}`;
        case 'secret':
          return `      - name: ${vol.name}\n        secret:\n          secretName: ${vol.source}`;
        case 'emptyDir':
          return `      - name: ${vol.name}\n        emptyDir: {}`;
        case 'persistentVolumeClaim':
          return `      - name: ${vol.name}\n        persistentVolumeClaim:\n          claimName: ${vol.source}`;
        default:
          return '';
      }
    }).join('\n') || '';

    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.agentName}
  namespace: ${config.namespace}
  labels:
    app: ${config.agentName}
    version: ${config.image.tag}
spec:
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${config.agentName}
  template:
    metadata:
      labels:
        app: ${config.agentName}
        version: ${config.image.tag}
    spec:
      containers:
      - name: ${config.agentName}
        image: ${config.image.registry}/${config.image.repository}:${config.image.tag}
        imagePullPolicy: ${config.image.pullPolicy}
        ports:
        - containerPort: ${config.service.targetPort}
          name: http
        env:
${envVars}
        resources:
          requests:
            cpu: ${config.resources.requests.cpu}
            memory: ${config.resources.requests.memory}
          limits:
            cpu: ${config.resources.limits.cpu}
            memory: ${config.resources.limits.memory}${config.healthCheck.enabled ? `
        livenessProbe:
          httpGet:
            path: ${config.healthCheck.path}
            port: http
          initialDelaySeconds: ${config.healthCheck.initialDelaySeconds}
          periodSeconds: ${config.healthCheck.periodSeconds}
        readinessProbe:
          httpGet:
            path: ${config.healthCheck.path}
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5` : ''}${volumeMounts ? `
        volumeMounts:
${volumeMounts}` : ''}${volumes ? `
      volumes:
${volumes}` : ''}`;
  }

  private generateServiceManifest(config: DeploymentConfig): string {
    return `apiVersion: v1
kind: Service
metadata:
  name: ${config.agentName}-service
  namespace: ${config.namespace}
  labels:
    app: ${config.agentName}
spec:
  type: ${config.service.type}
  ports:
  - port: ${config.service.port}
    targetPort: ${config.service.targetPort}
    protocol: TCP
    name: http
  selector:
    app: ${config.agentName}`;
  }

  private generateConfigMapManifest(config: DeploymentConfig): string {
    const data = Object.entries(config.configMaps || {}).map(([key, value]) => 
      `  ${key}: "${value}"`
    ).join('\n');

    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${config.agentName}-config
  namespace: ${config.namespace}
  labels:
    app: ${config.agentName}
data:
${data}`;
  }

  private generateSecretManifest(config: DeploymentConfig): string {
    const data = Object.entries(config.secrets || {}).map(([key, value]) => 
      `  ${key}: ${Buffer.from(value).toString('base64')}`
    ).join('\n');

    return `apiVersion: v1
kind: Secret
metadata:
  name: ${config.agentName}-secret
  namespace: ${config.namespace}
  labels:
    app: ${config.agentName}
type: Opaque
data:
${data}`;
  }

  private generateIngressManifest(config: DeploymentConfig): string {
    const tls = config.ingress?.tls ? `
  tls:
  - hosts:
    - ${config.ingress.host}
    secretName: ${config.agentName}-tls` : '';

    return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${config.agentName}-ingress
  namespace: ${config.namespace}
  labels:
    app: ${config.agentName}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:${tls}
  rules:
  - host: ${config.ingress?.host}
    http:
      paths:
      - path: ${config.ingress?.path || '/'}
        pathType: Prefix
        backend:
          service:
            name: ${config.agentName}-service
            port:
              number: ${config.service.port}`;
  }

  private generateHPAManifest(config: DeploymentConfig): string {
    return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${config.agentName}-hpa
  namespace: ${config.namespace}
  labels:
    app: ${config.agentName}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${config.agentName}
  minReplicas: ${config.autoscaling?.minReplicas}
  maxReplicas: ${config.autoscaling?.maxReplicas}
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: ${config.autoscaling?.targetCPUUtilizationPercentage}`;
  }

  private async generateGitHubActionsPipeline(config: DeploymentConfig, pipelineConfig: PipelineConfig): Promise<void> {
    const workflow = `name: Deploy ${config.agentName}

on:
  push:
    branches: [${pipelineConfig.triggers.branches.map(b => `'${b}'`).join(', ')}]
  pull_request:
    branches: [${pipelineConfig.triggers.branches.map(b => `'${b}'`).join(', ')}]

env:
${Object.entries(pipelineConfig.environment).map(([key, value]) => `  ${key}: ${value}`).join('\n')}

jobs:
${pipelineConfig.stages.map(stage => `
  ${stage.name.toLowerCase().replace(/\s+/g, '-')}:
    runs-on: ubuntu-latest
    steps:
${stage.steps.map(step => `    - name: ${step.name}
      uses: ${step.action}
      with:
${Object.entries(step.parameters).map(([key, value]) => `        ${key}: ${value}`).join('\n')}`).join('\n')}
`).join('')}`;

    const workflowPath = path.join(this.outputPath, '..', '.github', 'workflows', `${config.agentName}.yml`);
    await this.ensureDirectory(path.dirname(workflowPath));
    await fs.writeFile(workflowPath, workflow);
  }

  private async generateGitLabCIPipeline(config: DeploymentConfig, pipelineConfig: PipelineConfig): Promise<void> {
    const pipeline = `# GitLab CI/CD Pipeline for ${config.agentName}

variables:
${Object.entries(pipelineConfig.environment).map(([key, value]) => `  ${key}: ${value}`).join('\n')}

stages:
${pipelineConfig.stages.map(stage => `  - ${stage.name}`).join('\n')}

${pipelineConfig.stages.map(stage => `
${stage.name}:
  stage: ${stage.name}
  script:
${stage.steps.map(step => `    - ${step.action}`).join('\n')}
`).join('')}`;

    const pipelinePath = path.join(this.outputPath, '..', '.gitlab-ci.yml');
    await fs.writeFile(pipelinePath, pipeline);
  }

  private async generateJenkinsPipeline(config: DeploymentConfig, pipelineConfig: PipelineConfig): Promise<void> {
    const pipeline = `pipeline {
    agent any
    
    environment {
${Object.entries(pipelineConfig.environment).map(([key, value]) => `        ${key} = '${value}'`).join('\n')}
    }
    
    stages {
${pipelineConfig.stages.map(stage => `
        stage('${stage.name}') {
            steps {
${stage.steps.map(step => `                ${step.action}`).join('\n')}
            }
        }`).join('')}
    }
}`;

    const pipelinePath = path.join(this.outputPath, '..', 'Jenkinsfile');
    await fs.writeFile(pipelinePath, pipeline);
  }

  private async generateAzureDevOpsPipeline(config: DeploymentConfig, pipelineConfig: PipelineConfig): Promise<void> {
    const pipeline = `# Azure DevOps Pipeline for ${config.agentName}

trigger:
  branches:
    include:
${pipelineConfig.triggers.branches.map(b => `    - ${b}`).join('\n')}

variables:
${Object.entries(pipelineConfig.environment).map(([key, value]) => `  ${key}: ${value}`).join('\n')}

stages:
${pipelineConfig.stages.map(stage => `
- stage: ${stage.name.replace(/\s+/g, '')}
  displayName: '${stage.name}'
  jobs:
  - job: ${stage.name.replace(/\s+/g, '')}Job
    displayName: '${stage.name} Job'
    steps:
${stage.steps.map(step => `    - task: ${step.action}
      displayName: '${step.name}'`).join('\n')}`).join('')}`;

    const pipelinePath = path.join(this.outputPath, '..', 'azure-pipelines.yml');
    await fs.writeFile(pipelinePath, pipeline);
  }

  private async generateDeploymentScripts(config: DeploymentConfig): Promise<void> {
    // Generate deploy script
    const deployScript = `#!/bin/bash
# Deployment script for ${config.agentName}

set -e

NAMESPACE="${config.namespace}"
AGENT_NAME="${config.agentName}"

echo "Deploying \$AGENT_NAME to namespace \$NAMESPACE..."

# Apply manifests
kubectl apply -f \${AGENT_NAME}-namespace.yaml
kubectl apply -f \${AGENT_NAME}-configmap.yaml
kubectl apply -f \${AGENT_NAME}-secret.yaml
kubectl apply -f \${AGENT_NAME}-deployment.yaml
kubectl apply -f \${AGENT_NAME}-service.yaml
kubectl apply -f \${AGENT_NAME}-ingress.yaml
kubectl apply -f \${AGENT_NAME}-hpa.yaml

# Wait for deployment
kubectl rollout status deployment/\$AGENT_NAME -n \$NAMESPACE

echo "Deployment completed successfully!"`;

    const deployScriptPath = path.join(this.outputPath, 'deploy.sh');
    await fs.writeFile(deployScriptPath, deployScript, { mode: 0o755 });

    // Generate cleanup script
    const cleanupScript = `#!/bin/bash
# Cleanup script for ${config.agentName}

set -e

NAMESPACE="${config.namespace}"
AGENT_NAME="${config.agentName}"

echo "Cleaning up \$AGENT_NAME from namespace \$NAMESPACE..."

# Delete resources
kubectl delete -f \${AGENT_NAME}-hpa.yaml --ignore-not-found=true
kubectl delete -f \${AGENT_NAME}-ingress.yaml --ignore-not-found=true
kubectl delete -f \${AGENT_NAME}-service.yaml --ignore-not-found=true
kubectl delete -f \${AGENT_NAME}-deployment.yaml --ignore-not-found=true
kubectl delete -f \${AGENT_NAME}-secret.yaml --ignore-not-found=true
kubectl delete -f \${AGENT_NAME}-configmap.yaml --ignore-not-found=true

echo "Cleanup completed!"`;

    const cleanupScriptPath = path.join(this.outputPath, 'cleanup.sh');
    await fs.writeFile(cleanupScriptPath, cleanupScript, { mode: 0o755 });
  }

  private validateConfig(config: DeploymentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.agentName) {
      errors.push('Agent name is required');
    }

    if (!config.namespace) {
      errors.push('Namespace is required');
    }

    if (!config.image.registry || !config.image.repository || !config.image.tag) {
      errors.push('Complete image configuration is required');
    }

    if (config.replicas < 1) {
      errors.push('Replicas must be at least 1');
    }

    return { valid: errors.length === 0, errors };
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async getManifestFiles(config: DeploymentConfig): Promise<string[]> {
    const files = [
      `${config.agentName}-namespace.yaml`,
      `${config.agentName}-deployment.yaml`,
      `${config.agentName}-service.yaml`
    ];

    if (config.configMaps && Object.keys(config.configMaps).length > 0) {
      files.push(`${config.agentName}-configmap.yaml`);
    }

    if (config.secrets && Object.keys(config.secrets).length > 0) {
      files.push(`${config.agentName}-secret.yaml`);
    }

    if (config.ingress?.enabled) {
      files.push(`${config.agentName}-ingress.yaml`);
    }

    if (config.autoscaling?.enabled) {
      files.push(`${config.agentName}-hpa.yaml`);
    }

    return files.map(file => path.join(this.outputPath, file));
  }
}