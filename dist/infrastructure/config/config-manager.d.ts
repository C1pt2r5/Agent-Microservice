/**
 * Configuration management utilities
 */
import { AgentConfig } from '../../types';
export declare class ConfigManager {
    static loadConfig(configPath?: string): AgentConfig;
    static validateConfig(config: AgentConfig): string[];
}
//# sourceMappingURL=config-manager.d.ts.map