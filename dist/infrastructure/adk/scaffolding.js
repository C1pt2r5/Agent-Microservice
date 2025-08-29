"use strict";
/**
 * Agent Development Kit (ADK) - Scaffolding and Templates
 * Provides tools for rapid agent creation and project structure automation
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
exports.AgentScaffolding = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const events_1 = require("events");
class AgentScaffolding extends events_1.EventEmitter {
    constructor(templatePath = './templates') {
        super();
        this.templates = new Map();
        this.templatePath = templatePath;
        this.initializeBuiltInTemplates();
    }
    /**
     * Generate a new agent from template
     */
    async generateAgent(options) {
        const startTime = Date.now();
        const result = {
            success: false,
            filesCreated: [],
            filesModified: [],
            errors: [],
            warnings: [],
            summary: {
                totalFiles: 0,
                totalSize: 0,
                processingTime: 0
            }
        };
        try {
            this.emit('scaffoldingStarted', options);
            // Validate options
            const validation = await this.validateOptions(options);
            if (!validation.valid) {
                result.errors.push(...validation.errors);
                return result;
            }
            // Get template
            const template = this.templates.get(options.template);
            if (!template) {
                result.errors.push(`Template '${options.template}' not found`);
                return result;
            }
            // Validate template variables
            const variableValidation = this.validateTemplateVariables(template, options.variables);
            if (!variableValidation.valid) {
                result.errors.push(...variableValidation.errors);
            }
            result.warnings.push(...variableValidation.warnings);
            // Execute pre-generate hooks
            if (template.configuration.hooks.preGenerate) {
                await this.executeHooks(template.configuration.hooks.preGenerate, options);
            }
            // Create output directory
            await this.ensureDirectory(options.outputPath);
            // Process template files
            for (const templateFile of template.files) {
                try {
                    const processedFile = await this.processTemplateFile(templateFile, options);
                    const outputFilePath = path.join(options.outputPath, processedFile.path);
                    if (options.dryRun) {
                        result.filesCreated.push(outputFilePath);
                        continue;
                    }
                    // Check if file exists
                    const fileExists = await this.fileExists(outputFilePath);
                    if (fileExists && !options.overwrite) {
                        result.warnings.push(`File already exists: ${outputFilePath}`);
                        continue;
                    }
                    // Ensure directory exists
                    await this.ensureDirectory(path.dirname(outputFilePath));
                    // Write file
                    await fs_1.promises.writeFile(outputFilePath, processedFile.content, {
                        mode: processedFile.executable ? 0o755 : 0o644
                    });
                    if (fileExists) {
                        result.filesModified.push(outputFilePath);
                    }
                    else {
                        result.filesCreated.push(outputFilePath);
                    }
                    result.summary.totalSize += processedFile.content.length;
                }
                catch (error) {
                    result.errors.push(`Failed to process file ${templateFile.path}: ${error}`);
                }
            }
            // Execute post-generate hooks
            if (template.configuration.hooks.postGenerate) {
                await this.executeHooks(template.configuration.hooks.postGenerate, options);
            }
            // Generate package.json if not exists
            if (!options.dryRun) {
                await this.generatePackageJson(options, template);
            }
            // Generate configuration files
            if (!options.dryRun) {
                await this.generateConfigFiles(options, template);
            }
            result.summary.totalFiles = result.filesCreated.length + result.filesModified.length;
            result.summary.processingTime = Date.now() - startTime;
            result.success = result.errors.length === 0;
            this.emit('scaffoldingCompleted', { options, result });
            return result;
        }
        catch (error) {
            result.errors.push(`Scaffolding failed: ${error}`);
            result.summary.processingTime = Date.now() - startTime;
            this.emit('scaffoldingError', { options, error });
            return result;
        }
    }
    /**
     * List available templates
     */
    getAvailableTemplates() {
        return Array.from(this.templates.values());
    }
    /**
     * Get template by name
     */
    getTemplate(name) {
        return this.templates.get(name);
    }
    /**
     * Register a new template
     */
    registerTemplate(template) {
        this.templates.set(template.name, template);
        this.emit('templateRegistered', template);
    }
    /**
     * Load templates from directory
     */
    async loadTemplatesFromDirectory(directory) {
        try {
            const entries = await fs_1.promises.readdir(directory, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const templatePath = path.join(directory, entry.name);
                    const template = await this.loadTemplate(templatePath);
                    if (template) {
                        this.registerTemplate(template);
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to load templates from directory:', error);
        }
    }
    async loadTemplate(templatePath) {
        try {
            const configPath = path.join(templatePath, 'template.json');
            const configContent = await fs_1.promises.readFile(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            const files = [];
            await this.loadTemplateFiles(templatePath, '', files);
            return {
                name: config.name,
                description: config.description,
                type: config.type,
                files,
                dependencies: config.dependencies || [],
                configuration: config.configuration || { variables: [], hooks: {}, validation: [] }
            };
        }
        catch (error) {
            console.error(`Failed to load template from ${templatePath}:`, error);
            return null;
        }
    }
    async loadTemplateFiles(basePath, relativePath, files) {
        const fullPath = path.join(basePath, relativePath);
        const entries = await fs_1.promises.readdir(fullPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'template.json')
                continue; // Skip config file
            const entryPath = path.join(relativePath, entry.name);
            const fullEntryPath = path.join(fullPath, entry.name);
            if (entry.isDirectory()) {
                await this.loadTemplateFiles(basePath, entryPath, files);
            }
            else {
                const content = await fs_1.promises.readFile(fullEntryPath, 'utf-8');
                const stats = await fs_1.promises.stat(fullEntryPath);
                files.push({
                    path: entryPath,
                    content,
                    executable: (stats.mode & 0o111) !== 0,
                    template: entry.name.endsWith('.template') || content.includes('{{')
                });
            }
        }
    }
    initializeBuiltInTemplates() {
        // Basic Agent Template
        this.registerTemplate({
            name: 'basic-agent',
            description: 'Basic agent with minimal functionality',
            type: 'basic',
            files: [
                {
                    path: 'src/{{agentName}}/{{agentName}}-agent.ts',
                    content: this.getBasicAgentTemplate(),
                    template: true
                },
                {
                    path: 'src/{{agentName}}/index.ts',
                    content: this.getBasicIndexTemplate(),
                    template: true
                },
                {
                    path: 'src/{{agentName}}/__tests__/{{agentName}}-agent.test.ts',
                    content: this.getBasicTestTemplate(),
                    template: true
                }
            ],
            dependencies: [],
            configuration: {
                variables: [
                    {
                        name: 'agentName',
                        description: 'Name of the agent (kebab-case)',
                        type: 'string',
                        required: true,
                        validation: '^[a-z][a-z0-9-]*[a-z0-9]$'
                    },
                    {
                        name: 'agentClass',
                        description: 'Agent class name (PascalCase)',
                        type: 'string',
                        required: true,
                        validation: '^[A-Z][a-zA-Z0-9]*Agent$'
                    },
                    {
                        name: 'description',
                        description: 'Agent description',
                        type: 'string',
                        required: false,
                        default: 'A basic agent implementation'
                    }
                ],
                hooks: {},
                validation: []
            }
        });
        // AI-Powered Agent Template
        this.registerTemplate({
            name: 'ai-agent',
            description: 'AI-powered agent with Gemini integration',
            type: 'ai-powered',
            files: [
                {
                    path: 'src/{{agentName}}/{{agentName}}-agent.ts',
                    content: this.getAIAgentTemplate(),
                    template: true
                },
                {
                    path: 'src/{{agentName}}/{{agentName}}-service.ts',
                    content: this.getAIServiceTemplate(),
                    template: true
                },
                {
                    path: 'src/{{agentName}}/index.ts',
                    content: this.getAIIndexTemplate(),
                    template: true
                },
                {
                    path: 'src/{{agentName}}/__tests__/{{agentName}}-agent.test.ts',
                    content: this.getAITestTemplate(),
                    template: true
                }
            ],
            dependencies: ['@google/generative-ai'],
            configuration: {
                variables: [
                    {
                        name: 'agentName',
                        description: 'Name of the agent (kebab-case)',
                        type: 'string',
                        required: true,
                        validation: '^[a-z][a-z0-9-]*[a-z0-9]$'
                    },
                    {
                        name: 'agentClass',
                        description: 'Agent class name (PascalCase)',
                        type: 'string',
                        required: true,
                        validation: '^[A-Z][a-zA-Z0-9]*Agent$'
                    },
                    {
                        name: 'aiCapabilities',
                        description: 'AI capabilities to include',
                        type: 'array',
                        required: false,
                        default: ['text-generation', 'classification'],
                        options: ['text-generation', 'classification', 'embedding', 'streaming']
                    }
                ],
                hooks: {},
                validation: []
            }
        });
        // Full-Stack Agent Template
        this.registerTemplate({
            name: 'fullstack-agent',
            description: 'Complete agent with service integration, API, and monitoring',
            type: 'full-stack',
            files: [
                {
                    path: 'src/{{agentName}}/{{agentName}}-agent.ts',
                    content: this.getFullStackAgentTemplate(),
                    template: true
                },
                {
                    path: 'src/{{agentName}}/{{agentName}}-service.ts',
                    content: this.getFullStackServiceTemplate(),
                    template: true
                },
                {
                    path: 'src/{{agentName}}/index.ts',
                    content: this.getFullStackIndexTemplate(),
                    template: true
                },
                {
                    path: 'src/{{agentName}}/__tests__/{{agentName}}-agent.test.ts',
                    content: this.getFullStackTestTemplate(),
                    template: true
                },
                {
                    path: 'src/{{agentName}}/__tests__/{{agentName}}-service.test.ts',
                    content: this.getFullStackServiceTestTemplate(),
                    template: true
                },
                {
                    path: 'k8s/{{agentName}}-deployment.yaml',
                    content: this.getKubernetesDeploymentTemplate(),
                    template: true
                },
                {
                    path: 'k8s/{{agentName}}-service.yaml',
                    content: this.getKubernetesServiceTemplate(),
                    template: true
                }
            ],
            dependencies: ['@google/generative-ai', 'express', 'ws'],
            configuration: {
                variables: [
                    {
                        name: 'agentName',
                        description: 'Name of the agent (kebab-case)',
                        type: 'string',
                        required: true,
                        validation: '^[a-z][a-z0-9-]*[a-z0-9]$'
                    },
                    {
                        name: 'agentClass',
                        description: 'Agent class name (PascalCase)',
                        type: 'string',
                        required: true,
                        validation: '^[A-Z][a-zA-Z0-9]*Agent$'
                    },
                    {
                        name: 'port',
                        description: 'Service port number',
                        type: 'number',
                        required: false,
                        default: 8080
                    },
                    {
                        name: 'includeWebSocket',
                        description: 'Include WebSocket support',
                        type: 'boolean',
                        required: false,
                        default: false
                    }
                ],
                hooks: {
                    postGenerate: ['npm install', 'npm run build']
                },
                validation: []
            }
        });
    }
    async processTemplateFile(templateFile, options) {
        let content = templateFile.content;
        let filePath = templateFile.path;
        if (templateFile.template) {
            // Process template variables
            content = this.processTemplateVariables(content, options.variables);
            filePath = this.processTemplateVariables(filePath, options.variables);
        }
        return {
            ...templateFile,
            path: filePath,
            content
        };
    }
    processTemplateVariables(content, variables) {
        let processed = content;
        // Replace simple variables {{variable}}
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            processed = processed.replace(regex, String(value));
        }
        // Process conditional blocks {{#if variable}}...{{/if}}
        processed = processed.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
            return variables[variable] ? content : '';
        });
        // Process loops {{#each array}}...{{/each}}
        processed = processed.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, variable, content) => {
            const array = variables[variable];
            if (Array.isArray(array)) {
                return array.map(item => {
                    let itemContent = content;
                    if (typeof item === 'object') {
                        Object.keys(item).forEach(key => {
                            itemContent = itemContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(item[key]));
                        });
                    }
                    else {
                        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
                    }
                    return itemContent;
                }).join('');
            }
            return '';
        });
        return processed;
    }
    async validateOptions(options) {
        const errors = [];
        if (!options.agentName) {
            errors.push('Agent name is required');
        }
        else if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(options.agentName)) {
            errors.push('Agent name must be in kebab-case format');
        }
        if (!options.template) {
            errors.push('Template is required');
        }
        if (!options.outputPath) {
            errors.push('Output path is required');
        }
        return { valid: errors.length === 0, errors };
    }
    validateTemplateVariables(template, variables) {
        const errors = [];
        const warnings = [];
        for (const variable of template.configuration.variables) {
            const value = variables[variable.name];
            if (variable.required && (value === undefined || value === null)) {
                errors.push(`Required variable '${variable.name}' is missing`);
                continue;
            }
            if (value !== undefined && variable.validation) {
                const regex = new RegExp(variable.validation);
                if (!regex.test(String(value))) {
                    errors.push(`Variable '${variable.name}' does not match pattern: ${variable.validation}`);
                }
            }
            if (value === undefined && variable.default !== undefined) {
                variables[variable.name] = variable.default;
                warnings.push(`Using default value for '${variable.name}': ${variable.default}`);
            }
        }
        return { valid: errors.length === 0, errors, warnings };
    }
    async executeHooks(hooks, options) {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        for (const hook of hooks) {
            try {
                await execAsync(hook, { cwd: options.outputPath });
            }
            catch (error) {
                console.warn(`Hook failed: ${hook}`, error);
            }
        }
    }
    async ensureDirectory(dirPath) {
        try {
            await fs_1.promises.mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            // Directory might already exist
        }
    }
    async fileExists(filePath) {
        try {
            await fs_1.promises.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async generatePackageJson(options, template) {
        const packageJsonPath = path.join(options.outputPath, 'package.json');
        if (await this.fileExists(packageJsonPath)) {
            return; // Don't overwrite existing package.json
        }
        const packageJson = {
            name: options.agentName,
            version: '1.0.0',
            description: `${options.agentName} agent implementation`,
            main: 'dist/index.js',
            scripts: {
                build: 'tsc',
                start: 'node dist/index.js',
                dev: 'ts-node src/index.ts',
                test: 'jest',
                'test:watch': 'jest --watch'
            },
            dependencies: {
                ...template.dependencies.reduce((acc, dep) => {
                    acc[dep] = 'latest';
                    return acc;
                }, {})
            },
            devDependencies: {
                '@types/node': '^20.0.0',
                '@types/jest': '^29.0.0',
                'typescript': '^5.0.0',
                'ts-node': '^10.0.0',
                'jest': '^29.0.0'
            }
        };
        await fs_1.promises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
    async generateConfigFiles(options, template) {
        // Generate tsconfig.json
        const tsconfigPath = path.join(options.outputPath, 'tsconfig.json');
        if (!(await this.fileExists(tsconfigPath))) {
            const tsconfig = {
                compilerOptions: {
                    target: 'ES2020',
                    module: 'commonjs',
                    lib: ['ES2020'],
                    outDir: './dist',
                    rootDir: './src',
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    forceConsistentCasingInFileNames: true,
                    resolveJsonModule: true,
                    declaration: true,
                    declarationMap: true,
                    sourceMap: true
                },
                include: ['src/**/*'],
                exclude: ['node_modules', 'dist', '**/*.test.ts']
            };
            await fs_1.promises.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
        }
        // Generate jest.config.js
        const jestConfigPath = path.join(options.outputPath, 'jest.config.js');
        if (!(await this.fileExists(jestConfigPath))) {
            const jestConfig = `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};`;
            await fs_1.promises.writeFile(jestConfigPath, jestConfig);
        }
    }
    // Template content methods
    getBasicAgentTemplate() {
        return `/**
 * {{agentClass}} implementation
 * {{description}}
 * Agent: {{agentName}}
 */

import { ConcreteBaseAgent } from '../base/base-agent';
import { AgentRequest, AgentResponse, SystemError } from '../../types';

export class {{agentClass}} extends ConcreteBaseAgent {
  
  /**
   * Process agent request
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { action, payload } = request.payload;

      switch (action) {
        case 'process':
          const result = await this.processData(payload);
          return this.createSuccessResponse(request, { result });

        default:
          return this.createErrorResponse(request, 'Unknown action', 'INVALID_ACTION');
      }

    } catch (error) {
      return this.createErrorResponse(
        request,
        error instanceof Error ? error.message : 'Unknown error',
        'PROCESSING_ERROR'
      );
    }
  }

  private async processData(data: any): Promise<any> {
    // Implement your agent logic here
    return { processed: true, data };
  }

  private createSuccessResponse(request: AgentRequest, payload: any): AgentResponse {
    return {
      id: \`response_\${Date.now()}\`,
      requestId: request.id,
      timestamp: new Date(),
      success: true,
      payload,
      processingTime: 0
    };
  }

  private createErrorResponse(request: AgentRequest, message: string, code: string): AgentResponse {
    const error: SystemError = {
      code,
      message,
      timestamp: new Date(),
      correlationId: request.correlationId
    };

    return {
      id: \`error_\${Date.now()}\`,
      requestId: request.id,
      timestamp: new Date(),
      success: false,
      error,
      processingTime: 0
    };
  }
}`;
    }
    getBasicIndexTemplate() {
        return `/**
 * {{agentClass}} exports
 */

export * from './{{agentName}}-agent';`;
    }
    getBasicTestTemplate() {
        return `/**
 * Unit tests for {{agentClass}}
 */

import { {{agentClass}} } from '../{{agentName}}-agent';
import { AgentConfig } from '../../../types';

describe('{{agentClass}}', () => {
  let agent: {{agentClass}};
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      id: '{{agentName}}-1',
      name: '{{agentClass}}',
      type: 'custom',
      mcpEndpoint: {
        url: 'http://localhost:8080',
        timeout: 30000,
        retryAttempts: 3
      },
      a2aEndpoint: {
        url: 'http://localhost:8081',
        timeout: 30000,
        retryAttempts: 3
      },
      geminiConfig: {
        apiKey: 'test-key',
        model: 'gemini-pro',
        endpoint: 'https://api.gemini.com',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      },
      capabilities: []
    };

    agent = new {{agentClass}}(config);
  });

  describe('processRequest', () => {
    it('should process requests successfully', async () => {
      const request = {
        id: 'req_123',
        timestamp: new Date(),
        correlationId: 'corr_123',
        payload: {
          action: 'process',
          payload: { test: 'data' }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload.result).toBeDefined();
    });

    it('should handle unknown actions', async () => {
      const request = {
        id: 'req_124',
        timestamp: new Date(),
        correlationId: 'corr_124',
        payload: {
          action: 'unknown',
          payload: {}
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INVALID_ACTION');
    });
  });
});`;
    }
    getAIAgentTemplate() {
        return `/**
 * {{agentClass}} with AI capabilities
 * {{description}}
 */

import { ConcreteBaseAgent } from '../base/base-agent';
import { AgentRequest, AgentResponse, SystemError } from '../../types';
import { EnhancedGeminiRequest } from '../../integration/gemini/enhanced-gemini-client';

export class {{agentClass}} extends ConcreteBaseAgent {
  
  /**
   * Process agent request with AI capabilities
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { action, payload } = request.payload;

      switch (action) {
        case 'analyze':
          const analysis = await this.analyzeWithAI(payload);
          return this.createSuccessResponse(request, { analysis });

        case 'generate':
          const generated = await this.generateContent(payload);
          return this.createSuccessResponse(request, { generated });

        default:
          return this.createErrorResponse(request, 'Unknown action', 'INVALID_ACTION');
      }

    } catch (error) {
      return this.createErrorResponse(
        request,
        error instanceof Error ? error.message : 'Unknown error',
        'PROCESSING_ERROR'
      );
    }
  }

  private async analyzeWithAI(data: any): Promise<any> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not available');
    }

    const request: EnhancedGeminiRequest = {
      id: \`ai_analysis_\${Date.now()}\`,
      timestamp: new Date(),
      prompt: \`Analyze the following data: \${JSON.stringify(data)}\`,
      options: {
        temperature: 0.3,
        maxTokens: 1000
      }
    };

    const response = await this.geminiClient.generateContent(request);
    
    if (!response.success) {
      throw new Error(\`AI analysis failed: \${response.error?.message}\`);
    }

    return {
      analysis: response.content,
      confidence: 0.8,
      processingTime: response.processingTime
    };
  }

  private async generateContent(data: any): Promise<any> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not available');
    }

    const request: EnhancedGeminiRequest = {
      id: \`ai_generation_\${Date.now()}\`,
      timestamp: new Date(),
      prompt: data.prompt || 'Generate content based on the provided context',
      options: {
        temperature: 0.7,
        maxTokens: 2000
      }
    };

    const response = await this.geminiClient.generateContent(request);
    
    if (!response.success) {
      throw new Error(\`Content generation failed: \${response.error?.message}\`);
    }

    return {
      content: response.content,
      usage: response.usage,
      processingTime: response.processingTime
    };
  }

  private createSuccessResponse(request: AgentRequest, payload: any): AgentResponse {
    return {
      id: \`response_\${Date.now()}\`,
      requestId: request.id,
      timestamp: new Date(),
      success: true,
      payload,
      processingTime: 0
    };
  }

  private createErrorResponse(request: AgentRequest, message: string, code: string): AgentResponse {
    const error: SystemError = {
      code,
      message,
      timestamp: new Date(),
      correlationId: request.correlationId
    };

    return {
      id: \`error_\${Date.now()}\`,
      requestId: request.id,
      timestamp: new Date(),
      success: false,
      error,
      processingTime: 0
    };
  }
}`;
    }
    getAIServiceTemplate() {
        return `/**
 * {{agentClass}} Service Integration
 */

import express, { Express, Request, Response } from 'express';
import { createServer, Server } from 'http';
import { EventEmitter } from 'events';
import { {{agentClass}} } from './{{agentName}}-agent';
import { AgentConfig } from '../../types';

export interface {{agentClass}}ServiceConfig extends AgentConfig {
  server: {
    port: number;
    host: string;
  };
}

export class {{agentClass}}Service extends EventEmitter {
  private agent: {{agentClass}};
  private config: {{agentClass}}ServiceConfig;
  private app: Express;
  private server: Server;

  constructor(config: {{agentClass}}ServiceConfig) {
    super();
    this.config = config;
    this.agent = new {{agentClass}}(config);
    this.app = express();
    this.server = createServer(this.app);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(express.json());
    
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    this.app.post('/process', async (req: Request, res: Response) => {
      try {
        const request = {
          id: \`req_\${Date.now()}\`,
          timestamp: new Date(),
          correlationId: req.headers['x-correlation-id'] as string || \`corr_\${Date.now()}\`,
          payload: req.body
        };

        const response = await this.agent.processRequest(request);
        res.json(response);
      } catch (error) {
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.server.port, this.config.server.host, () => {
        console.log(\`{{agentClass}} service listening on \${this.config.server.host}:\${this.config.server.port}\`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('{{agentClass}} service stopped');
        resolve();
      });
    });
  }
}`;
    }
    getServiceTemplate() {
        return `import express, { Request, Response } from 'express';
import { createServer, Server } from 'http';
import { {{agentClass}} } from './{{agentName}}-agent';
import { AgentConfig } from '../types';

export class {{agentClass}}Service {
  private app: express.Application;
  private server: Server;
  private agent: {{agentClass}};
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.agent = new {{agentClass}}(config);
    this.app = express();
    this.server = createServer(this.app);
    
    this.setupExpress();
  }

  async initialize(): Promise<void> {
    await this.agent.initialize();
    await this.startServer();
    console.log(\`{{agentClass}} Service started on \$\{this.config.server.host\}:\$\{this.config.server.port\}\`);
  }

  async shutdown(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    await this.agent.shutdown();
  }

  private setupExpress(): void {
    this.app.use(express.json());
    
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date() });
    });

    this.app.post('/api/analyze', async (req: Request, res: Response) => {
      try {
        const request = {
          id: \`req_\$\{Date.now()\}\`,
          timestamp: new Date(),
          correlationId: \`corr_\$\{Date.now()\}\`,
          payload: {
            action: 'analyze',
            payload: req.body
          }
        };

        const response = await this.agent.processRequest(request);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: 'Analysis failed' });
      }
    });

    this.app.post('/api/generate', async (req: Request, res: Response) => {
      try {
        const request = {
          id: \`req_\$\{Date.now()\}\`,
          timestamp: new Date(),
          correlationId: \`corr_\$\{Date.now()\}\`,
          payload: {
            action: 'generate',
            payload: req.body
          }
        };

        const response = await this.agent.processRequest(request);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: 'Generation failed' });
      }
    });
  }

  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.server.port, this.config.server.host, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}`;
    }
    getAIIndexTemplate() {
        return `/**
 * {{agentClass}} exports
 */

export * from './{{agentName}}-agent';
export * from './{{agentName}}-service';`;
    }
    getAITestTemplate() {
        return `/**
 * Unit tests for {{agentClass}}
 */

import { {{agentClass}} } from '../{{agentName}}-agent';
import { AgentConfig } from '../../../types';

describe('{{agentClass}}', () => {
  let agent: {{agentClass}};
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      id: '{{agentName}}-1',
      name: '{{agentClass}}',
      type: 'custom',
      mcpEndpoint: {
        url: 'http://localhost:8080',
        timeout: 30000,
        retryAttempts: 3
      },
      a2aEndpoint: {
        url: 'http://localhost:8081',
        timeout: 30000,
        retryAttempts: 3
      },
      geminiConfig: {
        apiKey: 'test-key',
        model: 'gemini-pro',
        endpoint: 'https://api.gemini.com',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      },
      capabilities: []
    };

    agent = new {{agentClass}}(config);
  });

  describe('AI capabilities', () => {
    it('should analyze data with AI', async () => {
      // Mock Gemini client
      if (agent['geminiClient']) {
        jest.spyOn(agent['geminiClient'], 'generateContent').mockResolvedValue({
          id: 'response_1',
          requestId: 'req_1',
          timestamp: new Date(),
          success: true,
          content: 'Analysis result',
          processingTime: 100
        });
      }

      const request = {
        id: 'req_123',
        timestamp: new Date(),
        correlationId: 'corr_123',
        payload: {
          action: 'analyze',
          payload: { data: 'test' }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload.analysis).toBeDefined();
    });

    it('should generate content with AI', async () => {
      // Mock Gemini client
      if (agent['geminiClient']) {
        jest.spyOn(agent['geminiClient'], 'generateContent').mockResolvedValue({
          id: 'response_2',
          requestId: 'req_2',
          timestamp: new Date(),
          success: true,
          content: 'Generated content',
          processingTime: 150
        });
      }

      const request = {
        id: 'req_124',
        timestamp: new Date(),
        correlationId: 'corr_124',
        payload: {
          action: 'generate',
          payload: { prompt: 'Generate something' }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload.generated).toBeDefined();
    });
  });
});`;
    }
    // Additional template methods for full-stack template would go here...
    getFullStackAgentTemplate() {
        return this.getAIAgentTemplate(); // Simplified for brevity
    }
    getFullStackServiceTemplate() {
        return this.getAIServiceTemplate(); // Simplified for brevity
    }
    getFullStackIndexTemplate() {
        return this.getAIIndexTemplate(); // Simplified for brevity
    }
    getFullStackTestTemplate() {
        return this.getAITestTemplate(); // Simplified for brevity
    }
    getFullStackServiceTestTemplate() {
        return `// Service integration tests would go here`;
    }
    getKubernetesDeploymentTemplate() {
        return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{agentName}}
  labels:
    app: {{agentName}}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: {{agentName}}
  template:
    metadata:
      labels:
        app: {{agentName}}
    spec:
      containers:
      - name: {{agentName}}
        image: {{agentName}}:latest
        ports:
        - containerPort: {{port}}
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"`;
    }
    getKubernetesServiceTemplate() {
        return `apiVersion: v1
kind: Service
metadata:
  name: {{agentName}}-service
spec:
  selector:
    app: {{agentName}}
  ports:
    - protocol: TCP
      port: 80
      targetPort: {{port}}
  type: ClusterIP`;
    }
}
exports.AgentScaffolding = AgentScaffolding;
//# sourceMappingURL=scaffolding.js.map