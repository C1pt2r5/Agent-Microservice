/**
 * Agent Development Kit (ADK) - Scaffolding and Templates
 * Provides tools for rapid agent creation and project structure automation
 */
import { EventEmitter } from 'events';
export interface AgentTemplate {
    name: string;
    description: string;
    type: 'basic' | 'ai-powered' | 'service-integration' | 'full-stack';
    files: TemplateFile[];
    dependencies: string[];
    configuration: TemplateConfig;
}
export interface TemplateFile {
    path: string;
    content: string;
    executable?: boolean;
    template?: boolean;
}
export interface TemplateConfig {
    variables: TemplateVariable[];
    hooks: {
        preGenerate?: string[];
        postGenerate?: string[];
    };
    validation: ValidationRule[];
}
export interface TemplateVariable {
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    default?: any;
    validation?: string;
    options?: string[];
}
export interface ValidationRule {
    field: string;
    rule: string;
    message: string;
}
export interface ScaffoldingOptions {
    agentName: string;
    agentType: 'chatbot' | 'fraud-detection' | 'recommendation' | 'custom';
    template: string;
    outputPath: string;
    variables: Record<string, any>;
    overwrite?: boolean;
    dryRun?: boolean;
}
export interface ScaffoldingResult {
    success: boolean;
    filesCreated: string[];
    filesModified: string[];
    errors: string[];
    warnings: string[];
    summary: {
        totalFiles: number;
        totalSize: number;
        processingTime: number;
    };
}
export declare class AgentScaffolding extends EventEmitter {
    private templates;
    private templatePath;
    constructor(templatePath?: string);
    /**
     * Generate a new agent from template
     */
    generateAgent(options: ScaffoldingOptions): Promise<ScaffoldingResult>;
    /**
     * List available templates
     */
    getAvailableTemplates(): AgentTemplate[];
    /**
     * Get template by name
     */
    getTemplate(name: string): AgentTemplate | undefined;
    /**
     * Register a new template
     */
    registerTemplate(template: AgentTemplate): void;
    /**
     * Load templates from directory
     */
    loadTemplatesFromDirectory(directory: string): Promise<void>;
    private loadTemplate;
    private loadTemplateFiles;
    private initializeBuiltInTemplates;
    private processTemplateFile;
    private processTemplateVariables;
    private validateOptions;
    private validateTemplateVariables;
    private executeHooks;
    private ensureDirectory;
    private fileExists;
    private generatePackageJson;
    private generateConfigFiles;
    private getBasicAgentTemplate;
    private getBasicIndexTemplate;
    private getBasicTestTemplate;
    private getAIAgentTemplate;
    private getAIServiceTemplate;
    private getServiceTemplate;
    private getAIIndexTemplate;
    private getAITestTemplate;
    private getFullStackAgentTemplate;
    private getFullStackServiceTemplate;
    private getFullStackIndexTemplate;
    private getFullStackTestTemplate;
    private getFullStackServiceTestTemplate;
    private getKubernetesDeploymentTemplate;
    private getKubernetesServiceTemplate;
}
//# sourceMappingURL=scaffolding.d.ts.map