/**
 * Main entry point for the agentic microservices system
 */
import { AgentConfig } from './types';
export * from './types';
export * from './agents';
export * from './integration';
export * from './infrastructure/adk';
export * from './infrastructure/config';
export * as Monitoring from './infrastructure/monitoring';
export declare function bootstrap(agentConfig: AgentConfig): Promise<void>;
export declare const defaultConfig: AgentConfig;
//# sourceMappingURL=index.d.ts.map