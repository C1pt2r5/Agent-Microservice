/**
 * Unit tests for Agent Scaffolding
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { AgentScaffolding, ScaffoldingOptions } from '../scaffolding';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    access: jest.fn(),
    stat: jest.fn()
  }
}));

describe('AgentScaffolding', () => {
  let scaffolding: AgentScaffolding;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    mockFs = fs as jest.Mocked<typeof fs>;
    scaffolding = new AgentScaffolding();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('File not found')); // Default to file not exists
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('template management', () => {
    it('should have built-in templates', () => {
      const templates = scaffolding.getAvailableTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.name === 'basic-agent')).toBe(true);
      expect(templates.some(t => t.name === 'ai-agent')).toBe(true);
      expect(templates.some(t => t.name === 'fullstack-agent')).toBe(true);
    });

    it('should get template by name', () => {
      const template = scaffolding.getTemplate('basic-agent');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('basic-agent');
      expect(template?.type).toBe('basic');
    });

    it('should register new template', () => {
      const customTemplate = {
        name: 'custom-template',
        description: 'Custom test template',
        type: 'basic' as const,
        files: [],
        dependencies: [],
        configuration: {
          variables: [],
          hooks: {},
          validation: []
        }
      };

      scaffolding.registerTemplate(customTemplate);
      
      const retrieved = scaffolding.getTemplate('custom-template');
      expect(retrieved).toEqual(customTemplate);
    });
  });

  describe('agent generation', () => {
    let options: ScaffoldingOptions;

    beforeEach(() => {
      options = {
        agentName: 'test-agent',
        agentType: 'custom',
        template: 'basic-agent',
        outputPath: '/test/output',
        variables: {
          agentName: 'test-agent',
          agentClass: 'TestAgent',
          description: 'Test agent description'
        }
      };
    });

    it('should generate agent successfully', async () => {
      const result = await scaffolding.generateAgent(options);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.filesCreated.length).toBeGreaterThan(0);
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should validate required options', async () => {
      const invalidOptions = {
        ...options,
        agentName: '' // Invalid name
      };

      const result = await scaffolding.generateAgent(invalidOptions);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Agent name is required');
    });

    it('should validate agent name format', async () => {
      const invalidOptions = {
        ...options,
        agentName: 'InvalidName' // Should be kebab-case
      };

      const result = await scaffolding.generateAgent(invalidOptions);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('kebab-case'))).toBe(true);
    });

    it('should handle missing template', async () => {
      const invalidOptions = {
        ...options,
        template: 'non-existent-template'
      };

      const result = await scaffolding.generateAgent(invalidOptions);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('not found'))).toBe(true);
    });

    it('should process template variables', async () => {
      const result = await scaffolding.generateAgent(options);

      expect(result.success).toBe(true);
      
      // Check that writeFile was called with processed content
      const writeFileCalls = mockFs.writeFile.mock.calls;
      const agentFileCall = writeFileCalls.find(call => 
        call[0].toString().includes('test-agent-agent.ts')
      );
      
      expect(agentFileCall).toBeDefined();
      expect(agentFileCall?.[1]).toContain('TestAgent');
      expect(agentFileCall?.[1]).toContain('test-agent');
    });

    it('should handle dry run mode', async () => {
      const dryRunOptions = {
        ...options,
        dryRun: true
      };

      const result = await scaffolding.generateAgent(dryRunOptions);

      expect(result.success).toBe(true);
      expect(result.filesCreated.length).toBeGreaterThan(0);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle existing files without overwrite', async () => {
      // Mock file exists
      mockFs.access.mockResolvedValue(undefined);

      const result = await scaffolding.generateAgent(options);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('already exists'))).toBe(true);
    });

    it('should overwrite existing files when specified', async () => {
      // Mock file exists
      mockFs.access.mockResolvedValue(undefined);

      const overwriteOptions = {
        ...options,
        overwrite: true
      };

      const result = await scaffolding.generateAgent(overwriteOptions);

      expect(result.success).toBe(true);
      expect(result.filesModified.length).toBeGreaterThan(0);
    });

    it('should validate template variables', async () => {
      const template = scaffolding.getTemplate('basic-agent');
      expect(template).toBeDefined();

      // Missing required variable
      const invalidOptions = {
        ...options,
        variables: {
          // Missing agentName and agentClass
          description: 'Test description'
        }
      };

      const result = await scaffolding.generateAgent(invalidOptions);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Required variable'))).toBe(true);
    });

    it('should use default values for optional variables', async () => {
      const optionsWithoutDescription = {
        ...options,
        variables: {
          agentName: 'test-agent',
          agentClass: 'TestAgent'
          // description is optional and should use default
        }
      };

      const result = await scaffolding.generateAgent(optionsWithoutDescription);

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('default value'))).toBe(true);
    });
  });

  describe('template processing', () => {
    it('should process simple variable substitution', () => {
      const content = 'Hello {{name}}, welcome to {{project}}!';
      const variables = { name: 'John', project: 'TestProject' };

      const processed = scaffolding['processTemplateVariables'](content, variables);

      expect(processed).toBe('Hello John, welcome to TestProject!');
    });

    it('should process conditional blocks', () => {
      const content = 'Start{{#if includeFeature}} - Feature included{{/if}} End';
      
      const withFeature = scaffolding['processTemplateVariables'](content, { includeFeature: true });
      const withoutFeature = scaffolding['processTemplateVariables'](content, { includeFeature: false });

      expect(withFeature).toBe('Start - Feature included End');
      expect(withoutFeature).toBe('Start End');
    });

    it('should process loops', () => {
      const content = 'Items:{{#each items}} - {{this}}{{/each}}';
      const variables = { items: ['apple', 'banana', 'cherry'] };

      const processed = scaffolding['processTemplateVariables'](content, variables);

      expect(processed).toBe('Items: - apple - banana - cherry');
    });

    it('should process object loops', () => {
      const content = 'Users:{{#each users}} - {{name}} ({{age}}){{/each}}';
      const variables = { 
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 }
        ]
      };

      const processed = scaffolding['processTemplateVariables'](content, variables);

      expect(processed).toBe('Users: - Alice (30) - Bob (25)');
    });
  });

  describe('validation', () => {
    it('should validate options correctly', async () => {
      const validOptions = {
        agentName: 'valid-agent',
        agentType: 'custom' as const,
        template: 'basic-agent',
        outputPath: '/valid/path',
        variables: {}
      };

      const validation = await scaffolding['validateOptions'](validOptions);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should catch invalid agent names', async () => {
      const invalidOptions = {
        agentName: 'Invalid_Name',
        agentType: 'custom' as const,
        template: 'basic-agent',
        outputPath: '/path',
        variables: {}
      };

      const validation = await scaffolding['validateOptions'](invalidOptions);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('kebab-case'))).toBe(true);
    });

    it('should validate template variables with regex', () => {
      const template = {
        name: 'test-template',
        description: 'Test template',
        type: 'basic' as const,
        files: [],
        dependencies: [],
        configuration: {
          variables: [
            {
              name: 'email',
              description: 'Email address',
              type: 'string' as const,
              required: true,
              validation: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$'
            }
          ],
          hooks: {},
          validation: []
        }
      };

      const validVariables = { email: 'test@example.com' };
      const invalidVariables = { email: 'invalid-email' };

      const validResult = scaffolding['validateTemplateVariables'](template, validVariables);
      const invalidResult = scaffolding['validateTemplateVariables'](template, invalidVariables);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.some(e => e.includes('does not match pattern'))).toBe(true);
    });
  });

  describe('file operations', () => {
    it('should ensure directory creation', async () => {
      await scaffolding['ensureDirectory']('/test/path');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/path', { recursive: true });
    });

    it('should check file existence', async () => {
      // Mock file exists
      mockFs.access.mockResolvedValueOnce(undefined);
      const exists = await scaffolding['fileExists']('/test/file.txt');
      expect(exists).toBe(true);

      // Mock file doesn't exist
      mockFs.access.mockRejectedValueOnce(new Error('Not found'));
      const notExists = await scaffolding['fileExists']('/test/missing.txt');
      expect(notExists).toBe(false);
    });
  });

  describe('configuration generation', () => {
    it('should generate package.json', async () => {
      const options: ScaffoldingOptions = {
        agentName: 'test-agent',
        agentType: 'custom',
        template: 'basic-agent',
        outputPath: '/test',
        variables: {}
      };

      const template = scaffolding.getTemplate('basic-agent')!;
      
      await scaffolding['generatePackageJson'](options, template);

      const packageJsonCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().includes('package.json')
      );

      expect(packageJsonCall).toBeDefined();
      
      const packageJson = JSON.parse(packageJsonCall![1] as string);
      expect(packageJson.name).toBe('test-agent');
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.devDependencies).toBeDefined();
    });

    it('should generate TypeScript config', async () => {
      const options: ScaffoldingOptions = {
        agentName: 'test-agent',
        agentType: 'custom',
        template: 'basic-agent',
        outputPath: '/test',
        variables: {}
      };

      const template = scaffolding.getTemplate('basic-agent')!;
      
      await scaffolding['generateConfigFiles'](options, template);

      const tsconfigCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().includes('tsconfig.json')
      );

      expect(tsconfigCall).toBeDefined();
      
      const tsconfig = JSON.parse(tsconfigCall![1] as string);
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.target).toBe('ES2020');
    });

    it('should generate Jest config', async () => {
      const options: ScaffoldingOptions = {
        agentName: 'test-agent',
        agentType: 'custom',
        template: 'basic-agent',
        outputPath: '/test',
        variables: {}
      };

      const template = scaffolding.getTemplate('basic-agent')!;
      
      await scaffolding['generateConfigFiles'](options, template);

      const jestConfigCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().includes('jest.config.js')
      );

      expect(jestConfigCall).toBeDefined();
      expect(jestConfigCall![1]).toContain('ts-jest');
      expect(jestConfigCall![1]).toContain('testEnvironment');
    });
  });

  describe('error handling', () => {
    it('should handle file write errors gracefully', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const options: ScaffoldingOptions = {
        agentName: 'test-agent',
        agentType: 'custom',
        template: 'basic-agent',
        outputPath: '/test',
        variables: {
          agentName: 'test-agent',
          agentClass: 'TestAgent'
        }
      };

      const result = await scaffolding.generateAgent(options);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Failed to process file'))).toBe(true);
    });

    it('should handle template processing errors', async () => {
      const options: ScaffoldingOptions = {
        agentName: 'test-agent',
        agentType: 'custom',
        template: 'basic-agent',
        outputPath: '/test',
        variables: {} // Missing required variables
      };

      const result = await scaffolding.generateAgent(options);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('events', () => {
    it('should emit scaffolding events', async () => {
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();

      scaffolding.on('scaffoldingStarted', startedSpy);
      scaffolding.on('scaffoldingCompleted', completedSpy);

      const options: ScaffoldingOptions = {
        agentName: 'test-agent',
        agentType: 'custom',
        template: 'basic-agent',
        outputPath: '/test',
        variables: {
          agentName: 'test-agent',
          agentClass: 'TestAgent'
        }
      };

      await scaffolding.generateAgent(options);

      expect(startedSpy).toHaveBeenCalledWith(options);
      expect(completedSpy).toHaveBeenCalled();
    });

    it('should emit template registration events', () => {
      const registeredSpy = jest.fn();
      scaffolding.on('templateRegistered', registeredSpy);

      const template = {
        name: 'event-test-template',
        description: 'Test template for events',
        type: 'basic' as const,
        files: [],
        dependencies: [],
        configuration: {
          variables: [],
          hooks: {},
          validation: []
        }
      };

      scaffolding.registerTemplate(template);

      expect(registeredSpy).toHaveBeenCalledWith(template);
    });
  });
});