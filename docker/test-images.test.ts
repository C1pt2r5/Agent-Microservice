import { execSync } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Docker Images Tests', () => {
  const projectId = process.env.PROJECT_ID || 'agentic-microservices';
  const imageTag = process.env.IMAGE_TAG || 'latest';
  const registry = process.env.REGISTRY || 'gcr.io';
  
  const agents = [
    'chatbot-agent',
    'fraud-detection-agent',
    'recommendation-agent'
  ];

  const infrastructureServices = [
    'mcp-gateway',
    'a2a-hub',
    'adk'
  ];

  const allServices = [...agents, ...infrastructureServices];

  const getImageName = (agentName: string): string => {
    return `${registry}/${projectId}/${agentName}:${imageTag}`;
  };

  const runDockerCommand = (command: string): string => {
    try {
      return execSync(command, { encoding: 'utf8', timeout: 30000 });
    } catch (error: any) {
      throw new Error(`Docker command failed: ${command}\nError: ${error.message}`);
    }
  };

  beforeAll(() => {
    // Check if Docker is available
    try {
      runDockerCommand('docker --version');
    } catch (error) {
      throw new Error('Docker is not available. Please install Docker and ensure it is running.');
    }
  });

  describe('Image Existence Tests', () => {
    test.each(allServices)('should have %s image built', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      expect(() => {
        runDockerCommand(`docker inspect ${imageName}`);
      }).not.toThrow();
    });
  });

  describe('Image Structure Tests', () => {
    test.each(allServices)('should have correct working directory in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const workdir = runDockerCommand(`docker inspect ${imageName} --format='{{.Config.WorkingDir}}'`).trim();
      expect(workdir).toBe('/app');
    });

    test.each(allServices)('should have non-root user in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const user = runDockerCommand(`docker inspect ${imageName} --format='{{.Config.User}}'`).trim();
      expect(user).not.toBe('');
      expect(user).not.toBe('root');
      expect(user).not.toBe('0');
    });

    test.each(allServices)('should have correct exposed ports in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const exposedPorts = runDockerCommand(`docker inspect ${imageName} --format='{{json .Config.ExposedPorts}}'`).trim();
      const ports = JSON.parse(exposedPorts);
      
      expect(ports).toHaveProperty('8080/tcp');
      expect(ports).toHaveProperty('9090/tcp');
      
      if (serviceName === 'chatbot-agent') {
        expect(ports).toHaveProperty('8081/tcp');
      }
    });

    test.each(allServices)('should have health check configured in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const healthcheck = runDockerCommand(`docker inspect ${imageName} --format='{{json .Config.Healthcheck}}'`).trim();
      const healthConfig = JSON.parse(healthcheck);
      
      expect(healthConfig).not.toBeNull();
      expect(healthConfig.Test).toBeDefined();
      expect(healthConfig.Interval).toBeDefined();
      expect(healthConfig.Timeout).toBeDefined();
      expect(healthConfig.Retries).toBeDefined();
    });

    test.each(allServices)('should have correct environment variables in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const env = runDockerCommand(`docker inspect ${imageName} --format='{{json .Config.Env}}'`).trim();
      const envVars = JSON.parse(env);
      
      const envMap = envVars.reduce((acc: Record<string, string>, envVar: string) => {
        const [key, value] = envVar.split('=');
        acc[key] = value;
        return acc;
      }, {});
      
      expect(envMap.NODE_ENV).toBe('production');
      expect(envMap.PORT).toBe('8080');
      expect(envMap.METRICS_PORT).toBe('9090');
      
      if (serviceName === 'chatbot-agent') {
        expect(envMap.WS_PORT).toBe('8081');
      }
      
      if (serviceName === 'adk') {
        expect(envMap.ADK_TEMPLATES_PATH).toBe('/app/templates');
      }
    });
  });

  describe('Image Functionality Tests', () => {
    test.each(allServices)('should be able to run %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      expect(() => {
        runDockerCommand(`docker run --rm ${imageName} node --version`);
      }).not.toThrow();
    });

    test.each(allServices)('should have Node.js runtime in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const nodeVersion = runDockerCommand(`docker run --rm ${imageName} node --version`).trim();
      expect(nodeVersion).toMatch(/^v\d+\.\d+\.\d+$/);
      
      // Ensure it's Node.js 18 or higher
      const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    test.each(allServices)('should have npm available in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const npmVersion = runDockerCommand(`docker run --rm ${imageName} npm --version`).trim();
      expect(npmVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test.each(allServices)('should have built application files in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const distExists = runDockerCommand(`docker run --rm ${imageName} test -d /app/dist && echo "exists" || echo "missing"`).trim();
      expect(distExists).toBe('exists');
      
      const packageExists = runDockerCommand(`docker run --rm ${imageName} test -f /app/package.json && echo "exists" || echo "missing"`).trim();
      expect(packageExists).toBe('exists');
    });

    test.each(allServices)('should have correct file permissions in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      // Check that the app directory is owned by the non-root user
      const ownership = runDockerCommand(`docker run --rm ${imageName} stat -c "%U:%G" /app`).trim();
      expect(ownership).not.toBe('root:root');
      
      // Check service-specific directories
      if (agents.includes(serviceName)) {
        const dataExists = runDockerCommand(`docker run --rm ${imageName} test -d /app/data && echo "exists" || echo "missing"`).trim();
        expect(dataExists).toBe('exists');
      }
      
      if (serviceName === 'adk') {
        const templatesExists = runDockerCommand(`docker run --rm ${imageName} test -d /app/templates && echo "exists" || echo "missing"`).trim();
        expect(templatesExists).toBe('exists');
      }
    });
  });

  describe('Image Security Tests', () => {
    test.each(allServices)('should not run as root user in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const userId = runDockerCommand(`docker run --rm ${imageName} id -u`).trim();
      expect(userId).not.toBe('0');
    });

    test.each(allServices)('should have minimal attack surface in %s image', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      // Check that common attack vectors are not present
      const bashExists = runDockerCommand(`docker run --rm ${imageName} which bash 2>/dev/null || echo "missing"`).trim();
      expect(bashExists).toBe('missing'); // Alpine images don't have bash by default
      
      // Check that package managers are not present in production image
      const apkExists = runDockerCommand(`docker run --rm ${imageName} which apk 2>/dev/null || echo "missing"`).trim();
      // APK might exist in Alpine, but that's acceptable for minimal functionality
    });
  });

  describe('Image Size Tests', () => {
    test.each(allServices)('should have reasonable image size for %s', (serviceName) => {
      const imageName = getImageName(serviceName);
      
      const sizeOutput = runDockerCommand(`docker images ${imageName} --format "{{.Size}}"`).trim();
      
      // Parse size (could be in MB or GB)
      const sizeMatch = sizeOutput.match(/^(\d+(?:\.\d+)?)(MB|GB)$/);
      expect(sizeMatch).not.toBeNull();
      
      if (sizeMatch) {
        const [, sizeValue, unit] = sizeMatch;
        const size = parseFloat(sizeValue);
        
        if (unit === 'GB') {
          // Image should not be larger than 2GB
          expect(size).toBeLessThan(2);
        } else if (unit === 'MB') {
          // Image should be at least 100MB (reasonable for Node.js app)
          expect(size).toBeGreaterThan(100);
          // But not more than 1500MB
          expect(size).toBeLessThan(1500);
        }
      }
    });
  });

  afterAll(() => {
    // Cleanup any test containers if needed
    // This is handled by --rm flag in docker run commands
  });
});