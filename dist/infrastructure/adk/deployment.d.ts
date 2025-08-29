/**
 * Agent Development Kit (ADK) - Deployment Automation
 * Provides tools for Kubernetes manifest generation, Docker containerization, and deployment pipelines
 */
import { EventEmitter } from 'events';
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
export declare class DeploymentAutomation extends EventEmitter {
    private outputPath;
    constructor(outputPath?: string);
    /**
     * Generate complete deployment package
     */
    generateDeployment(config: DeploymentConfig, dockerConfig?: DockerConfig, pipelineConfig?: PipelineConfig): Promise<DeploymentResult>;
    /**
     * Generate Kubernetes manifests
     */
    generateKubernetesManifests(config: DeploymentConfig): Promise<GeneratedManifest[]>;
    /**
     * Generate Dockerfile
     */
    generateDockerfile(config: DeploymentConfig, dockerConfig: DockerConfig): Promise<string>;
    /**
     * Generate CI/CD pipeline
     */
    generatePipeline(config: DeploymentConfig, pipelineConfig: PipelineConfig): Promise<void>;
    /**
     * Deploy to Kubernetes cluster
     */
    deployToCluster(config: DeploymentConfig, options?: {
        kubeconfig?: string;
        context?: string;
        dryRun?: boolean;
        force?: boolean;
    }): Promise<{
        success: boolean;
        output: string;
        errors: string[];
    }>;
    /**
     * Build and push Docker image
     */
    buildAndPushImage(config: DeploymentConfig, options?: {
        buildContext?: string;
        dockerfile?: string;
        push?: boolean;
        registry?: string;
    }): Promise<{
        success: boolean;
        imageTag: string;
        output: string;
        errors: string[];
    }>;
    private generateNamespaceManifest;
    private generateDeploymentManifest;
    private generateServiceManifest;
    private generateConfigMapManifest;
    private generateSecretManifest;
    private generateIngressManifest;
    private generateHPAManifest;
    private generateGitHubActionsPipeline;
    private generateGitLabCIPipeline;
    private generateJenkinsPipeline;
    private generateAzureDevOpsPipeline;
    private generateDeploymentScripts;
    private validateConfig;
    private ensureDirectory;
    private getManifestFiles;
}
//# sourceMappingURL=deployment.d.ts.map