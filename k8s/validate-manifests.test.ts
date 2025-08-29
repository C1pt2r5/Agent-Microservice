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
  data?: Record<string, string>;
  rules?: any[];
  subjects?: any[];
  roleRef?: any;
  type?: string;
}

describe('Kubernetes Manifests Validation', () => {
  const manifestsDir = __dirname;
  const manifestFiles = [
    'namespaces.yaml',
    'rbac.yaml',
    'configmaps.yaml',
    'secrets.yaml',
    'services.yaml',
    'ingress.yaml'
  ];

  let manifests: Record<string, KubernetesResource[]> = {};

  beforeAll(() => {
    // Load all manifest files
    manifestFiles.forEach(file => {
      const filePath = path.join(manifestsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      manifests[file] = yaml.loadAll(content) as KubernetesResource[];
    });
  });

  describe('Namespace Validation', () => {
    test('should have all required namespaces', () => {
      const namespaces = manifests['namespaces.yaml'];
      const namespaceNames = namespaces.map(ns => ns.metadata.name);
      
      expect(namespaceNames).toContain('ai-agents');
      expect(namespaceNames).toContain('integration');
      expect(namespaceNames).toContain('infrastructure');
    });

    test('should have proper labels on namespaces', () => {
      const namespaces = manifests['namespaces.yaml'];
      
      namespaces.forEach(ns => {
        expect(ns.metadata.labels).toBeDefined();
        expect(ns.metadata.labels!['app.kubernetes.io/name']).toBe('agentic-microservices');
        expect(ns.metadata.labels!['app.kubernetes.io/component']).toBeDefined();
      });
    });
  });

  describe('RBAC Validation', () => {
    test('should have service accounts for each namespace', () => {
      const rbacResources = manifests['rbac.yaml'];
      const serviceAccounts = rbacResources.filter(resource => resource.kind === 'ServiceAccount');
      
      expect(serviceAccounts).toHaveLength(3);
      
      const serviceAccountNamespaces = serviceAccounts.map(sa => sa.metadata.namespace);
      expect(serviceAccountNamespaces).toContain('ai-agents');
      expect(serviceAccountNamespaces).toContain('integration');
      expect(serviceAccountNamespaces).toContain('infrastructure');
    });

    test('should have cluster role with appropriate permissions', () => {
      const rbacResources = manifests['rbac.yaml'];
      const clusterRole = rbacResources.find(resource => resource.kind === 'ClusterRole');
      
      expect(clusterRole).toBeDefined();
      expect(clusterRole!.rules).toBeDefined();
      expect(clusterRole!.rules!.length).toBeGreaterThan(0);
      
      // Check for required permissions
      const hasPodsPermission = clusterRole!.rules!.some(rule => 
        rule.resources.includes('pods') && rule.verbs.includes('get')
      );
      expect(hasPodsPermission).toBe(true);
    });

    test('should have proper role bindings', () => {
      const rbacResources = manifests['rbac.yaml'];
      const clusterRoleBinding = rbacResources.find(resource => resource.kind === 'ClusterRoleBinding');
      const roleBinding = rbacResources.find(resource => resource.kind === 'RoleBinding');
      
      expect(clusterRoleBinding).toBeDefined();
      expect(roleBinding).toBeDefined();
      
      expect(clusterRoleBinding!.subjects).toHaveLength(3);
      expect(roleBinding!.subjects).toHaveLength(1);
    });
  });

  describe('ConfigMaps Validation', () => {
    test('should have configmaps for each namespace', () => {
      const configMaps = manifests['configmaps.yaml'];
      
      expect(configMaps).toHaveLength(3);
      
      const configMapNamespaces = configMaps.map(cm => cm.metadata.namespace);
      expect(configMapNamespaces).toContain('ai-agents');
      expect(configMapNamespaces).toContain('integration');
      expect(configMapNamespaces).toContain('infrastructure');
    });

    test('should have required configuration keys', () => {
      const configMaps = manifests['configmaps.yaml'];
      const aiAgentsConfig = configMaps.find(cm => cm.metadata.namespace === 'ai-agents');
      
      expect(aiAgentsConfig!.data).toBeDefined();
      expect(aiAgentsConfig!.data!.A2A_HUB_URL).toBeDefined();
      expect(aiAgentsConfig!.data!.MCP_GATEWAY_URL).toBeDefined();
      expect(aiAgentsConfig!.data!.GEMINI_API_ENDPOINT).toBeDefined();
      expect(aiAgentsConfig!.data!.LOG_LEVEL).toBeDefined();
    });

    test('should have valid URL formats', () => {
      const configMaps = manifests['configmaps.yaml'];
      const aiAgentsConfig = configMaps.find(cm => cm.metadata.namespace === 'ai-agents');
      
      const urlPattern = /^https?:\/\/.+/;
      expect(aiAgentsConfig!.data!.A2A_HUB_URL).toMatch(/^http:\/\/.+/);
      expect(aiAgentsConfig!.data!.MCP_GATEWAY_URL).toMatch(/^http:\/\/.+/);
      expect(aiAgentsConfig!.data!.GEMINI_API_ENDPOINT).toMatch(urlPattern);
    });
  });

  describe('Secrets Validation', () => {
    test('should have all required secrets', () => {
      const secrets = manifests['secrets.yaml'];
      
      expect(secrets).toHaveLength(4);
      
      const secretNames = secrets.map(secret => secret.metadata.name);
      expect(secretNames).toContain('gemini-api-secret');
      expect(secretNames).toContain('mcp-auth-secret');
      expect(secretNames).toContain('a2a-auth-secret');
      expect(secretNames).toContain('redis-auth-secret');
    });

    test('should have proper secret types', () => {
      const secrets = manifests['secrets.yaml'];
      
      secrets.forEach(secret => {
        expect(secret.type).toBe('Opaque');
        expect(secret.data).toBeDefined();
      });
    });

    test('should have base64 encoded data', () => {
      const secrets = manifests['secrets.yaml'];
      const geminiSecret = secrets.find(secret => secret.metadata.name === 'gemini-api-secret');
      
      expect(geminiSecret!.data!.GEMINI_API_KEY).toBeDefined();
      
      // Check if it's valid base64
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      expect(geminiSecret!.data!.GEMINI_API_KEY).toMatch(base64Pattern);
    });
  });

  describe('Services Validation', () => {
    test('should have services for all components', () => {
      const services = manifests['services.yaml'];
      
      const serviceNames = services.map(svc => svc.metadata.name);
      expect(serviceNames).toContain('mcp-gateway');
      expect(serviceNames).toContain('a2a-hub');
      expect(serviceNames).toContain('redis');
      expect(serviceNames).toContain('chatbot-agent');
      expect(serviceNames).toContain('fraud-detection-agent');
      expect(serviceNames).toContain('recommendation-agent');
      expect(serviceNames).toContain('adk-service');
    });

    test('should have proper service configurations', () => {
      const services = manifests['services.yaml'];
      
      services.forEach(service => {
        expect(service.spec.selector).toBeDefined();
        expect(service.spec.ports).toBeDefined();
        expect(service.spec.ports.length).toBeGreaterThan(0);
        expect(service.spec.type).toBe('ClusterIP');
        
        // Check port configurations
        service.spec.ports.forEach((port: any) => {
          expect(port.name).toBeDefined();
          expect(port.port).toBeDefined();
          expect(port.targetPort).toBeDefined();
          expect(port.protocol).toBe('TCP');
        });
      });
    });

    test('should have metrics ports for monitoring', () => {
      const services = manifests['services.yaml'];
      const agentServices = services.filter(svc => 
        svc.metadata.namespace === 'ai-agents' || 
        svc.metadata.namespace === 'integration'
      );
      
      agentServices.forEach(service => {
        if (service.metadata.name !== 'redis') {
          const metricsPort = service.spec.ports.find((port: any) => port.name === 'metrics');
          expect(metricsPort).toBeDefined();
          expect(metricsPort.port).toBe(9090);
        }
      });
    });
  });

  describe('Ingress Validation', () => {
    test('should have ingress configuration', () => {
      const ingresses = manifests['ingress.yaml'];
      const ingress = ingresses.find(resource => resource.kind === 'Ingress');
      
      expect(ingress).toBeDefined();
      expect(ingress!.spec.rules).toBeDefined();
      expect(ingress!.spec.rules.length).toBeGreaterThan(0);
    });

    test('should have proper host configurations', () => {
      const ingresses = manifests['ingress.yaml'];
      const ingress = ingresses.find(resource => resource.kind === 'Ingress');
      
      const hosts = ingress!.spec.rules.map((rule: any) => rule.host);
      expect(hosts).toContain('api.agentic-microservices.example.com');
      expect(hosts).toContain('integration.agentic-microservices.example.com');
      expect(hosts).toContain('admin.agentic-microservices.example.com');
    });

    test('should have SSL certificate configuration', () => {
      const ingresses = manifests['ingress.yaml'];
      const managedCert = ingresses.find(resource => resource.kind === 'ManagedCertificate');
      
      expect(managedCert).toBeDefined();
      expect(managedCert!.spec.domains).toBeDefined();
      expect(managedCert!.spec.domains.length).toBe(3);
    });

    test('should have proper path configurations', () => {
      const ingresses = manifests['ingress.yaml'];
      const ingress = ingresses.find(resource => resource.kind === 'Ingress');
      
      ingress!.spec.rules.forEach((rule: any) => {
        expect(rule.http.paths).toBeDefined();
        rule.http.paths.forEach((path: any) => {
          expect(path.path).toBeDefined();
          expect(path.pathType).toBe('Prefix');
          expect(path.backend.service.name).toBeDefined();
          expect(path.backend.service.port.number).toBeDefined();
        });
      });
    });
  });

  describe('Cross-Resource Validation', () => {
    test('should have matching service selectors and deployment labels', () => {
      const services = manifests['services.yaml'];
      
      services.forEach(service => {
        expect(service.spec.selector.app).toBeDefined();
        expect(service.spec.selector.app).toBe(service.metadata.name);
      });
    });

    test('should have consistent labeling across resources', () => {
      const allResources = Object.values(manifests).flat();
      
      allResources.forEach(resource => {
        if (resource.metadata && resource.metadata.labels) {
          expect(resource.metadata.labels['app.kubernetes.io/name']).toBe('agentic-microservices');
        }
      });
    });

    test('should have proper namespace references in services', () => {
      const configMaps = manifests['configmaps.yaml'];
      const aiAgentsConfig = configMaps.find(cm => cm.metadata.namespace === 'ai-agents');
      
      // Check that service URLs reference correct namespaces
      expect(aiAgentsConfig!.data!.A2A_HUB_URL).toContain('integration.svc.cluster.local');
      expect(aiAgentsConfig!.data!.MCP_GATEWAY_URL).toContain('integration.svc.cluster.local');
    });
  });

  describe('Security Validation', () => {
    test('should not have hardcoded sensitive values', () => {
      const configMaps = manifests['configmaps.yaml'];
      
      configMaps.forEach(configMap => {
        Object.values(configMap.data!).forEach(value => {
          // Check that no obvious passwords or keys are in plaintext
          expect(value.toLowerCase()).not.toContain('password');
          expect(value.toLowerCase()).not.toContain('secret');
          expect(value.toLowerCase()).not.toContain('key');
        });
      });
    });

    test('should have proper RBAC restrictions', () => {
      const rbacResources = manifests['rbac.yaml'];
      const role = rbacResources.find(resource => resource.kind === 'Role');
      
      // Ensure role doesn't have overly broad permissions
      role!.rules!.forEach(rule => {
        expect(rule.verbs).not.toContain('*');
        expect(rule.resources).not.toContain('*');
      });
    });
  });
});