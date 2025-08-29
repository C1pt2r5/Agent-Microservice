/**
 * Unit tests for Deployment Automation
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { DeploymentAutomation, DeploymentConfig, DockerConfig, PipelineConfig } from '../deployment';

// Mock fs and child_process modules
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn()
  }
}));

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

describe('DeploymentAutomation', () => {
  let deployment: DeploymentAutomation;
  let mockFs: jest.Mocked<typeof fs>;
  let mockConfig: DeploymentConfig;

  beforeEach(() => {
    mockFs = fs as jest.Mocked<typeof fs>;
    deployment = new DeploymentAutomation(path.join('.', 'test-k8s'));
    
    mockConfig = {
      agentName: 'test-agent',
      namespace: 'test-namespace',
      image: {
        registry: 'gcr.io',
        repository: 'test-project/test-agent',
        tag: 'v1.0.0',
        pullPolicy: 'IfNotPresent'
      },
      resources: {
        requests: {
          cpu: '100m',
          memory: '128Mi'
        },
        limits: {
          cpu: '500m',
          memory: '512Mi'
        }
      },
      replicas: 3,
      service: {
        type: 'ClusterIP',
        port: 80,
        targetPort: 8080
      },
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },
      healthCheck: {
        enabled: true,
        path: '/health',
        initialDelaySeconds: 30,
        periodSeconds: 10
      }
    };

    // Reset mocks
    jest.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('configuration validation', () => {
    it('should validate valid configuration', () => {
      const validation = deployment['validateConfig'](mockConfig);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should catch missing agent name', () => {
      const invalidConfig = { ...mockConfig, agentName: '' };
      const validation = deployment['validateConfig'](invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Agent name is required');
    });

    it('should catch missing namespace', () => {
      const invalidConfig = { ...mockConfig, namespace: '' };
      const validation = deployment['validateConfig'](invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Namespace is required');
    });

    it('should catch incomplete image configuration', () => {
      const invalidConfig = { 
        ...mockConfig, 
        image: { ...mockConfig.image, registry: '' }
      };
      const validation = deployment['validateConfig'](invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Complete image configuration is required');
    });

    it('should catch invalid replica count', () => {
      const invalidConfig = { ...mockConfig, replicas: 0 };
      const validation = deployment['validateConfig'](invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Replicas must be at least 1');
    });
  });

  describe('Kubernetes manifest generation', () => {
    it('should generate basic manifests', async () => {
      const manifests = await deployment.generateKubernetesManifests(mockConfig);
      
      expect(manifests.length).toBeGreaterThanOrEqual(3); // Namespace, Deployment, Service
      
      const namespaceManifest = manifests.find(m => m.kind === 'Namespace');
      const deploymentManifest = manifests.find(m => m.kind === 'Deployment');
      const serviceManifest = manifests.find(m => m.kind === 'Service');
      
      expect(namespaceManifest).toBeDefined();
      expect(deploymentManifest).toBeDefined();
      expect(serviceManifest).toBeDefined();
    });

    it('should generate namespace manifest correctly', () => {
      const manifest = deployment['generateNamespaceManifest'](mockConfig);
      
      expect(manifest).toContain('kind: Namespace');
      expect(manifest).toContain(`name: ${mockConfig.namespace}`);
      expect(manifest).toContain(`app: ${mockConfig.agentName}`);
    });

    it('should generate deployment manifest correctly', () => {
      const manifest = deployment['generateDeploymentManifest'](mockConfig);
      
      expect(manifest).toContain('kind: Deployment');
      expect(manifest).toContain(`name: ${mockConfig.agentName}`);
      expect(manifest).toContain(`namespace: ${mockConfig.namespace}`);
      expect(manifest).toContain(`replicas: ${mockConfig.replicas}`);
      expect(manifest).toContain(`image: ${mockConfig.image.registry}/${mockConfig.image.repository}:${mockConfig.image.tag}`);
      expect(manifest).toContain('NODE_ENV');
      expect(manifest).toContain('production');
    });

    it('should generate service manifest correctly', () => {
      const manifest = deployment['generateServiceManifest'](mockConfig);
      
      expect(manifest).toContain('kind: Service');
      expect(manifest).toContain(`name: ${mockConfig.agentName}-service`);
      expect(manifest).toContain(`type: ${mockConfig.service.type}`);
      expect(manifest).toContain(`port: ${mockConfig.service.port}`);
      expect(manifest).toContain(`targetPort: ${mockConfig.service.targetPort}`);
    });

    it('should generate ConfigMap when configMaps provided', async () => {
      const configWithConfigMap = {
        ...mockConfig,
        configMaps: {
          'app.properties': 'key=value',
          'config.json': '{"setting": "value"}'
        }
      };

      const manifests = await deployment.generateKubernetesManifests(configWithConfigMap);
      const configMapManifest = manifests.find(m => m.kind === 'ConfigMap');
      
      expect(configMapManifest).toBeDefined();
      expect(configMapManifest?.content).toContain('kind: ConfigMap');
      expect(configMapManifest?.content).toContain('app.properties');
      expect(configMapManifest?.content).toContain('config.json');
    });

    it('should generate Secret when secrets provided', async () => {
      const configWithSecrets = {
        ...mockConfig,
        secrets: {
          'api-key': 'secret-value',
          'database-password': 'db-password'
        }
      };

      const manifests = await deployment.generateKubernetesManifests(configWithSecrets);
      const secretManifest = manifests.find(m => m.kind === 'Secret');
      
      expect(secretManifest).toBeDefined();
      expect(secretManifest?.content).toContain('kind: Secret');
      expect(secretManifest?.content).toContain('api-key');
      expect(secretManifest?.content).toContain('database-password');
      // Should contain base64 encoded values
      expect(secretManifest?.content).toContain(Buffer.from('secret-value').toString('base64'));
    });

    it('should generate Ingress when enabled', async () => {
      const configWithIngress = {
        ...mockConfig,
        ingress: {
          enabled: true,
          host: 'test-agent.example.com',
          path: '/api',
          tls: true
        }
      };

      const manifests = await deployment.generateKubernetesManifests(configWithIngress);
      const ingressManifest = manifests.find(m => m.kind === 'Ingress');
      
      expect(ingressManifest).toBeDefined();
      expect(ingressManifest?.content).toContain('kind: Ingress');
      expect(ingressManifest?.content).toContain('test-agent.example.com');
      expect(ingressManifest?.content).toContain('/api');
      expect(ingressManifest?.content).toContain('tls:');
    });

    it('should generate HPA when autoscaling enabled', async () => {
      const configWithHPA = {
        ...mockConfig,
        autoscaling: {
          enabled: true,
          minReplicas: 2,
          maxReplicas: 10,
          targetCPUUtilizationPercentage: 70
        }
      };

      const manifests = await deployment.generateKubernetesManifests(configWithHPA);
      const hpaManifest = manifests.find(m => m.kind === 'HorizontalPodAutoscaler');
      
      expect(hpaManifest).toBeDefined();
      expect(hpaManifest?.content).toContain('kind: HorizontalPodAutoscaler');
      expect(hpaManifest?.content).toContain('minReplicas: 2');
      expect(hpaManifest?.content).toContain('maxReplicas: 10');
      expect(hpaManifest?.content).toContain('averageUtilization: 70');
    });
  });

  describe('Dockerfile generation', () => {
    it('should generate Dockerfile correctly', async () => {
      const dockerConfig: DockerConfig = {
        baseImage: 'node:18-alpine',
        workDir: '/app',
        port: 8080,
        labels: {
          'version': '1.0.0',
          'maintainer': 'team@example.com'
        },
        healthCheck: {
          command: 'curl -f http://localhost:8080/health || exit 1',
          interval: '30s',
          timeout: '10s',
          retries: 3
        }
      };

      const dockerfile = await deployment.generateDockerfile(mockConfig, dockerConfig);
      
      expect(dockerfile).toContain('FROM node:18-alpine AS builder');
      expect(dockerfile).toContain('WORKDIR /app');
      expect(dockerfile).toContain('EXPOSE 8080');
      expect(dockerfile).toContain('LABEL version="1.0.0"');
      expect(dockerfile).toContain('LABEL maintainer="team@example.com"');
      expect(dockerfile).toContain('HEALTHCHECK');
      expect(dockerfile).toContain('USER nodejs');
      expect(dockerfile).toContain('CMD ["node", "dist/index.js"]');
    });

    it('should generate Dockerfile without health check', async () => {
      const dockerConfig: DockerConfig = {
        baseImage: 'node:18-alpine',
        workDir: '/app',
        port: 8080
      };

      const dockerfile = await deployment.generateDockerfile(mockConfig, dockerConfig);
      
      expect(dockerfile).toContain('FROM node:18-alpine AS builder');
      expect(dockerfile).not.toContain('HEALTHCHECK');
    });
  });

  describe('pipeline generation', () => {
    let pipelineConfig: PipelineConfig;

    beforeEach(() => {
      pipelineConfig = {
        provider: 'github-actions',
        stages: [
          {
            name: 'Build',
            steps: [
              {
                name: 'Checkout code',
                action: 'actions/checkout@v3',
                parameters: {}
              },
              {
                name: 'Setup Node.js',
                action: 'actions/setup-node@v3',
                parameters: {
                  'node-version': '18'
                }
              }
            ]
          },
          {
            name: 'Deploy',
            steps: [
              {
                name: 'Deploy to Kubernetes',
                action: 'azure/k8s-deploy@v1',
                parameters: {
                  'manifests': 'k8s/'
                }
              }
            ]
          }
        ],
        triggers: {
          branches: ['main', 'develop']
        },
        environment: {
          'NODE_ENV': 'production',
          'REGISTRY': 'gcr.io'
        }
      };
    });

    it('should generate GitHub Actions pipeline', async () => {
      await deployment['generateGitHubActionsPipeline'](mockConfig, pipelineConfig);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.github[\/\\]workflows[\/\\]test-agent\.yml$/),
        expect.stringContaining('name: Deploy test-agent')
      );
    });

    it('should generate GitLab CI pipeline', async () => {
      pipelineConfig.provider = 'gitlab-ci';
      await deployment['generateGitLabCIPipeline'](mockConfig, pipelineConfig);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.gitlab-ci\.yml$/),
        expect.stringContaining('# GitLab CI/CD Pipeline for test-agent')
      );
    });

    it('should generate Jenkins pipeline', async () => {
      pipelineConfig.provider = 'jenkins';
      await deployment['generateJenkinsPipeline'](mockConfig, pipelineConfig);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/Jenkinsfile$/),
        expect.stringContaining('pipeline {')
      );
    });

    it('should generate Azure DevOps pipeline', async () => {
      pipelineConfig.provider = 'azure-devops';
      await deployment['generateAzureDevOpsPipeline'](mockConfig, pipelineConfig);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/azure-pipelines\.yml$/),
        expect.stringContaining('# Azure DevOps Pipeline for test-agent')
      );
    });
  });

  describe('deployment generation', () => {
    it('should generate complete deployment successfully', async () => {
      const dockerConfig: DockerConfig = {
        baseImage: 'node:18-alpine',
        workDir: '/app',
        port: 8080
      };

      const pipelineConfig: PipelineConfig = {
        provider: 'github-actions',
        stages: [],
        triggers: { branches: ['main'] },
        environment: {}
      };

      const result = await deployment.generateDeployment(mockConfig, dockerConfig, pipelineConfig);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.manifests.length).toBeGreaterThan(0);
      expect(result.dockerfile).toBeDefined();
      expect(result.summary.totalManifests).toBeGreaterThan(0);
    });

    it('should handle validation errors', async () => {
      const invalidConfig = { ...mockConfig, agentName: '' };
      
      const result = await deployment.generateDeployment(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Agent name is required');
    });

    it('should generate deployment scripts', async () => {
      await deployment['generateDeploymentScripts'](mockConfig);
      
      const deployScriptCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().includes('deploy.sh')
      );
      const cleanupScriptCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().includes('cleanup.sh')
      );
      
      expect(deployScriptCall).toBeDefined();
      expect(cleanupScriptCall).toBeDefined();
      
      expect(deployScriptCall![1]).toContain('kubectl apply');
      expect(deployScriptCall![1]).toContain('kubectl rollout status');
      expect(cleanupScriptCall![1]).toContain('kubectl delete');
    });
  });

  describe('manifest file operations', () => {
    it('should get correct manifest files list', async () => {
      const files = await deployment['getManifestFiles'](mockConfig);
      
      expect(files.some(file => file.includes('test-agent-namespace.yaml'))).toBe(true);
      expect(files.some(file => file.includes('test-agent-deployment.yaml'))).toBe(true);
      expect(files.some(file => file.includes('test-agent-service.yaml'))).toBe(true);
    });

    it('should include optional manifest files when configured', async () => {
      const configWithOptionals = {
        ...mockConfig,
        configMaps: { 'key': 'value' },
        secrets: { 'secret': 'value' },
        ingress: { enabled: true, host: 'example.com', path: '/' },
        autoscaling: { enabled: true, minReplicas: 1, maxReplicas: 5, targetCPUUtilizationPercentage: 70 }
      };

      const files = await deployment['getManifestFiles'](configWithOptionals);
      
      expect(files.some(file => file.includes('test-agent-configmap.yaml'))).toBe(true);
      expect(files.some(file => file.includes('test-agent-secret.yaml'))).toBe(true);
      expect(files.some(file => file.includes('test-agent-ingress.yaml'))).toBe(true);
      expect(files.some(file => file.includes('test-agent-hpa.yaml'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle file write errors gracefully', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      const result = await deployment.generateDeployment(mockConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Deployment generation failed'))).toBe(true);
    });

    it('should handle directory creation errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      // Should not throw error, as directory creation errors are ignored
      await expect(deployment['ensureDirectory'](path.join('test', 'path'))).resolves.not.toThrow();
    });
  });

  describe('events', () => {
    it('should emit deployment events', async () => {
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();

      deployment.on('deploymentStarted', startedSpy);
      deployment.on('deploymentCompleted', completedSpy);

      await deployment.generateDeployment(mockConfig);

      expect(startedSpy).toHaveBeenCalledWith(mockConfig);
      expect(completedSpy).toHaveBeenCalled();
    });

    it('should emit error events on failure', async () => {
      const errorSpy = jest.fn();
      deployment.on('deploymentError', errorSpy);

      mockFs.writeFile.mockRejectedValue(new Error('Test error'));

      await deployment.generateDeployment(mockConfig);

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});