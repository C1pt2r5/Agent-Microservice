"use strict";
/**
 * Agent Development Kit (ADK) - Deployment Automation
 * Provides tools for Kubernetes manifest generation, Docker containerization, and deployment pipelines
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentAutomation = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const events_1 = require("events");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class DeploymentAutomation extends events_1.EventEmitter {
    constructor(outputPath = './k8s') {
        super();
        this.outputPath = outputPath;
    }
    /**
     * Generate complete deployment package
     */
    async generateDeployment(config, dockerConfig, pipelineConfig) {
        const startTime = Date.now();
        const result = {
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
                await fs_1.promises.writeFile(filePath, manifest.content);
                result.summary.totalSize += manifest.content.length;
            }
            // Generate deployment scripts
            await this.generateDeploymentScripts(config);
            result.summary.totalManifests = result.manifests.length;
            result.summary.processingTime = Date.now() - startTime;
            result.success = true;
            this.emit('deploymentCompleted', { config, result });
            return result;
        }
        catch (error) {
            result.errors.push(`Deployment generation failed: ${error}`);
            result.summary.processingTime = Date.now() - startTime;
            this.emit('deploymentError', { config, error });
            return result;
        }
    }
    /**
     * Generate Kubernetes manifests
     */
    async generateKubernetesManifests(config) {
        const manifests = [];
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
    async generateDockerfile(config, dockerConfig) {
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
${Object.entries(dockerConfig.labels || {}).map(([key, value]) => `LABEL ${key}="${value}"`).join('\n')}

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
        await fs_1.promises.writeFile(dockerfilePath, dockerfile);
        return dockerfile;
    }
    /**
     * Generate CI/CD pipeline
     */
    async generatePipeline(config, pipelineConfig) {
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
    async deployToCluster(config, options = {}) {
        const errors = [];
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
        }
        catch (error) {
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
    async buildAndPushImage(config, options = {}) {
        const errors = [];
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
        }
        catch (error) {
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
    generateNamespaceManifest(config) {
        return `apiVersion: v1
kind: Namespace
metadata:
  name: ${config.namespace}
  labels:
    app: ${config.agentName}
    managed-by: adk`;
    }
    generateDeploymentManifest(config) {
        const envVars = Object.entries(config.environment).map(([key, value]) => `        - name: ${key}\n          value: "${value}"`).join('\n');
        const volumeMounts = config.volumes?.map(vol => `        - name: ${vol.name}\n          mountPath: ${vol.mountPath}`).join('\n') || '';
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
    generateServiceManifest(config) {
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
    generateConfigMapManifest(config) {
        const data = Object.entries(config.configMaps || {}).map(([key, value]) => `  ${key}: "${value}"`).join('\n');
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
    generateSecretManifest(config) {
        const data = Object.entries(config.secrets || {}).map(([key, value]) => `  ${key}: ${Buffer.from(value).toString('base64')}`).join('\n');
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
    generateIngressManifest(config) {
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
    generateHPAManifest(config) {
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
    async generateGitHubActionsPipeline(config, pipelineConfig) {
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
        await fs_1.promises.writeFile(workflowPath, workflow);
    }
    async generateGitLabCIPipeline(config, pipelineConfig) {
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
        await fs_1.promises.writeFile(pipelinePath, pipeline);
    }
    async generateJenkinsPipeline(config, pipelineConfig) {
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
        await fs_1.promises.writeFile(pipelinePath, pipeline);
    }
    async generateAzureDevOpsPipeline(config, pipelineConfig) {
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
        await fs_1.promises.writeFile(pipelinePath, pipeline);
    }
    async generateDeploymentScripts(config) {
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
        await fs_1.promises.writeFile(deployScriptPath, deployScript, { mode: 0o755 });
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
        await fs_1.promises.writeFile(cleanupScriptPath, cleanupScript, { mode: 0o755 });
    }
    validateConfig(config) {
        const errors = [];
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
    async ensureDirectory(dirPath) {
        try {
            await fs_1.promises.mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            // Directory might already exist
        }
    }
    async getManifestFiles(config) {
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
exports.DeploymentAutomation = DeploymentAutomation;
//# sourceMappingURL=deployment.js.map