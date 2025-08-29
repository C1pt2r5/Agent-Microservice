import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface KubernetesResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: any;
}

describe('Deployment Configurations Validation', () => {
  const manifestsDir = __dirname;
  const deploymentFiles = [
    'deployments.yaml',
    'hpa.yaml',
    'pvc.yaml'
  ];

  let manifests: Record<string, KubernetesResource[]> = {};

  beforeAll(() => {
    // Load all deployment manifest files
    deploymentFiles.forEach(file => {
      const filePath = path.join(manifestsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      manifests[file] = yaml.loadAll(content) as KubernetesResource[];
    });
  });

  describe('Deployment Manifests Validation', () => {
    test('should have deployments for all agents', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      
      const deploymentNames = deployments.map(dep => dep.metadata.name);
      expect(deploymentNames).toContain('chatbot-agent');
      expect(deploymentNames).toContain('fraud-detection-agent');
      expect(deploymentNames).toContain('recommendation-agent');
      expect(deploymentNames).toContain('mcp-gateway');
      expect(deploymentNames).toContain('a2a-hub');
      expect(deploymentNames).toContain('redis');
      expect(deploymentNames).toContain('adk-service');
    });

    test('should have proper deployment configurations', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      
      deployments.forEach(deployment => {
        expect(deployment.spec.replicas).toBeGreaterThan(0);
        expect(deployment.spec.selector.matchLabels).toBeDefined();
        expect(deployment.spec.template.metadata.labels).toBeDefined();
        expect(deployment.spec.template.spec.containers).toBeDefined();
        expect(deployment.spec.template.spec.containers.length).toBeGreaterThan(0);
        
        // Check container configuration
        deployment.spec.template.spec.containers.forEach((container: any) => {
          expect(container.name).toBeDefined();
          expect(container.image).toBeDefined();
          expect(container.ports).toBeDefined();
          expect(container.resources).toBeDefined();
          expect(container.resources.requests).toBeDefined();
          expect(container.resources.limits).toBeDefined();
        });
      });
    });

    test('should have health checks configured', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      
      deployments.forEach(deployment => {
        deployment.spec.template.spec.containers.forEach((container: any) => {
          if (container.name !== 'redis') {
            expect(container.livenessProbe).toBeDefined();
            expect(container.readinessProbe).toBeDefined();
          }
        });
      });
    });

    test('should have proper resource limits', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      
      // Helper function to parse Kubernetes resource values
      const parseResourceValue = (value: string, type: 'memory' | 'cpu'): number => {
        if (type === 'memory') {
          // Parse memory values like "256Mi", "1Gi"
          const match = value.match(/^(\d+)(Mi|Gi)$/);
          if (match) {
            const num = parseInt(match[1]);
            const unit = match[2];
            return unit === 'Gi' ? num * 1024 : num; // Convert to Mi
          }
        } else if (type === 'cpu') {
          // Parse CPU values like "250m", "1000m", "1"
          if (value.endsWith('m')) {
            return parseInt(value.slice(0, -1)); // Remove 'm' and parse
          } else {
            return parseInt(value) * 1000; // Convert to millicores
          }
        }
        return 0;
      };
      
      deployments.forEach(deployment => {
        deployment.spec.template.spec.containers.forEach((container: any) => {
          expect(container.resources.requests.memory).toBeDefined();
          expect(container.resources.requests.cpu).toBeDefined();
          expect(container.resources.limits.memory).toBeDefined();
          expect(container.resources.limits.cpu).toBeDefined();
          
          // Ensure limits are greater than or equal to requests
          const requestMemory = parseResourceValue(container.resources.requests.memory, 'memory');
          const limitMemory = parseResourceValue(container.resources.limits.memory, 'memory');
          const requestCpu = parseResourceValue(container.resources.requests.cpu, 'cpu');
          const limitCpu = parseResourceValue(container.resources.limits.cpu, 'cpu');
          
          expect(limitMemory).toBeGreaterThanOrEqual(requestMemory);
          expect(limitCpu).toBeGreaterThanOrEqual(requestCpu);
          
          // Ensure values are reasonable (not zero)
          expect(requestMemory).toBeGreaterThan(0);
          expect(limitMemory).toBeGreaterThan(0);
          expect(requestCpu).toBeGreaterThan(0);
          expect(limitCpu).toBeGreaterThan(0);
        });
      });
    });

    test('should use correct service accounts', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      
      deployments.forEach(deployment => {
        expect(deployment.spec.template.spec.serviceAccountName).toBeDefined();
        
        const namespace = deployment.metadata.namespace;
        const serviceAccount = deployment.spec.template.spec.serviceAccountName;
        
        if (namespace === 'ai-agents') {
          expect(serviceAccount).toBe('ai-agent-service-account');
        } else if (namespace === 'integration') {
          expect(serviceAccount).toBe('integration-service-account');
        } else if (namespace === 'infrastructure') {
          expect(serviceAccount).toBe('infrastructure-service-account');
        }
      });
    });

    test('should have environment variables configured', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      
      deployments.forEach(deployment => {
        deployment.spec.template.spec.containers.forEach((container: any) => {
          if (container.name !== 'redis') {
            expect(container.env || container.envFrom).toBeDefined();
            
            if (container.env) {
              const envNames = container.env.map((env: any) => env.name);
              expect(envNames).toContain('NODE_ENV');
              expect(envNames).toContain('PORT');
            }
          }
        });
      });
    });
  });

  describe('HPA Validation', () => {
    test('should have HPA for scalable services', () => {
      const hpas = manifests['hpa.yaml'];
      
      const hpaNames = hpas.map(hpa => hpa.metadata.name);
      expect(hpaNames).toContain('chatbot-agent-hpa');
      expect(hpaNames).toContain('fraud-detection-agent-hpa');
      expect(hpaNames).toContain('recommendation-agent-hpa');
      expect(hpaNames).toContain('mcp-gateway-hpa');
      expect(hpaNames).toContain('a2a-hub-hpa');
    });

    test('should have proper HPA configurations', () => {
      const hpas = manifests['hpa.yaml'];
      
      hpas.forEach(hpa => {
        expect(hpa.spec.scaleTargetRef).toBeDefined();
        expect(hpa.spec.minReplicas).toBeGreaterThan(0);
        expect(hpa.spec.maxReplicas).toBeGreaterThan(hpa.spec.minReplicas);
        expect(hpa.spec.metrics).toBeDefined();
        expect(hpa.spec.metrics.length).toBeGreaterThan(0);
        
        // Check for CPU and memory metrics
        const metricTypes = hpa.spec.metrics.map((metric: any) => metric.resource.name);
        expect(metricTypes).toContain('cpu');
        expect(metricTypes).toContain('memory');
      });
    });

    test('should have scaling behavior configured', () => {
      const hpas = manifests['hpa.yaml'];
      
      hpas.forEach(hpa => {
        expect(hpa.spec.behavior).toBeDefined();
        expect(hpa.spec.behavior.scaleUp).toBeDefined();
        expect(hpa.spec.behavior.scaleDown).toBeDefined();
        
        expect(hpa.spec.behavior.scaleUp.stabilizationWindowSeconds).toBeDefined();
        expect(hpa.spec.behavior.scaleDown.stabilizationWindowSeconds).toBeDefined();
      });
    });
  });

  describe('PVC Validation', () => {
    test('should have PVCs for data storage', () => {
      const pvcs = manifests['pvc.yaml'];
      
      const pvcNames = pvcs.map(pvc => pvc.metadata.name);
      expect(pvcNames).toContain('chatbot-agent-pvc');
      expect(pvcNames).toContain('fraud-detection-agent-pvc');
      expect(pvcNames).toContain('fraud-detection-models-pvc');
      expect(pvcNames).toContain('recommendation-agent-pvc');
      expect(pvcNames).toContain('redis-pvc');
      expect(pvcNames).toContain('adk-templates-pvc');
    });

    test('should have proper PVC configurations', () => {
      const pvcs = manifests['pvc.yaml'];
      
      pvcs.forEach(pvc => {
        expect(pvc.spec.accessModes).toBeDefined();
        expect(pvc.spec.accessModes.length).toBeGreaterThan(0);
        expect(pvc.spec.resources.requests.storage).toBeDefined();
        expect(pvc.spec.storageClassName).toBeDefined();
        
        // Check storage size format
        expect(pvc.spec.resources.requests.storage).toMatch(/^\d+Gi$/);
      });
    });

    test('should have appropriate access modes', () => {
      const pvcs = manifests['pvc.yaml'];
      
      pvcs.forEach(pvc => {
        const accessModes = pvc.spec.accessModes;
        
        // Most PVCs should use ReadWriteOnce
        if (pvc.metadata.name === 'fraud-detection-models-pvc') {
          expect(accessModes).toContain('ReadOnlyMany');
        } else if (pvc.metadata.name === 'adk-templates-pvc') {
          expect(accessModes).toContain('ReadWriteMany');
        } else {
          expect(accessModes).toContain('ReadWriteOnce');
        }
      });
    });
  });

  describe('Cross-Resource Validation', () => {
    test('should have matching deployment and HPA targets', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      const hpas = manifests['hpa.yaml'];
      
      hpas.forEach(hpa => {
        const targetName = hpa.spec.scaleTargetRef.name;
        const matchingDeployment = deployments.find(dep => dep.metadata.name === targetName);
        expect(matchingDeployment).toBeDefined();
      });
    });

    test('should have matching deployment and PVC volume mounts', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      const pvcs = manifests['pvc.yaml'];
      
      deployments.forEach(deployment => {
        if (deployment.spec.template.spec.volumes) {
          deployment.spec.template.spec.volumes.forEach((volume: any) => {
            if (volume.persistentVolumeClaim) {
              const pvcName = volume.persistentVolumeClaim.claimName;
              const matchingPvc = pvcs.find(pvc => pvc.metadata.name === pvcName);
              expect(matchingPvc).toBeDefined();
            }
          });
        }
      });
    });

    test('should have consistent labeling across deployment resources', () => {
      const allResources = Object.values(manifests).flat();
      
      allResources.forEach(resource => {
        if (resource.metadata && resource.metadata.labels) {
          expect(resource.metadata.labels['app.kubernetes.io/name']).toBe('agentic-microservices');
        }
      });
    });
  });

  describe('Security Validation', () => {
    test('should not run containers as root', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      
      deployments.forEach(deployment => {
        deployment.spec.template.spec.containers.forEach((container: any) => {
          // If securityContext is defined, ensure it's not running as root
          if (container.securityContext && container.securityContext.runAsUser !== undefined) {
            expect(container.securityContext.runAsUser).not.toBe(0);
          }
        });
      });
    });

    test('should use secrets for sensitive data', () => {
      const deployments = manifests['deployments.yaml'].filter(resource => resource.kind === 'Deployment');
      
      deployments.forEach(deployment => {
        deployment.spec.template.spec.containers.forEach((container: any) => {
          if (container.env) {
            container.env.forEach((envVar: any) => {
              // Check that sensitive environment variables use secrets
              if (envVar.name.includes('KEY') || envVar.name.includes('TOKEN') || envVar.name.includes('PASSWORD')) {
                expect(envVar.valueFrom).toBeDefined();
                expect(envVar.valueFrom.secretKeyRef).toBeDefined();
              }
            });
          }
        });
      });
    });
  });
});