/**
 * Prompt templates for different agent types and use cases
 */
export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    variables: string[];
    category: 'chatbot' | 'fraud-detection' | 'recommendation' | 'general';
    examples?: PromptExample[];
}
export interface PromptExample {
    input: Record<string, any>;
    expectedOutput: string;
}
export declare class PromptTemplateManager {
    private static readonly TEMPLATES;
    /**
     * Get a template by ID
     */
    static getTemplate(templateId: string): PromptTemplate | undefined;
    /**
     * Get all templates for a specific category
     */
    static getTemplatesByCategory(category: PromptTemplate['category']): PromptTemplate[];
    /**
     * Get all available templates
     */
    static getAllTemplates(): PromptTemplate[];
    /**
     * Render a template with provided variables
     */
    static renderTemplate(templateId: string, variables: Record<string, any>): string;
    /**
     * Validate that all required variables are provided
     */
    static validateVariables(templateId: string, variables: Record<string, any>): string[];
    /**
     * Create a custom template
     */
    static createCustomTemplate(template: PromptTemplate): void;
    /**
     * Simple template interpolation
     */
    private static interpolateTemplate;
    /**
     * Extract variables from a template string
     */
    static extractVariables(templateString: string): string[];
    /**
     * Get template suggestions based on use case
     */
    static getTemplateSuggestions(useCase: string, category?: PromptTemplate['category']): PromptTemplate[];
}
//# sourceMappingURL=prompt-templates.d.ts.map