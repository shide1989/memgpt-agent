import { Logger } from '../../../infrastructure/logging/logger.service';
import { HeartbeatConfig, AgentState, HeartbeatResult } from '../interfaces/heartbeat.interface';
import { OpenAIService } from '../../../infrastructure/openai/openai.service';
import { MemoryManager } from '../../memory/services/memory-manager.service';

export class HeartbeatManager {
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private state: AgentState;
    private config: HeartbeatConfig;

    constructor(
        private readonly openAIService: OpenAIService,
        private readonly memoryManager: MemoryManager,
        config?: Partial<HeartbeatConfig>
    ) {
        this.config = {
            intervalMs: 60000,        // 1 minute default
            maxIdleTimeMs: 300000,    // 5 minutes default
            minThoughtTokens: 50,
            maxThoughtTokens: 200,
            ...config
        };

        this.state = {
            isProcessing: false,
            lastUserInteraction: Date.now(),
            lastHeartbeat: Date.now()
        };
    }

    public startHeartbeat(): void {
        if (this.heartbeatInterval) {
            return;
        }

        Logger.info('Starting heartbeat mechanism');
        this.heartbeatInterval = setInterval(
            () => this.beat(),
            this.config.intervalMs
        );
    }

    public stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            Logger.info('Stopped heartbeat mechanism');
        }
    }

    public updateLastInteraction(): void {
        this.state.lastUserInteraction = Date.now();
    }

    private async beat(): Promise<HeartbeatResult> {
        try {
            this.state.lastHeartbeat = Date.now();

            // Skip if currently processing a user message
            if (this.state.isProcessing) {
                return { type: 'IDLE' };
            }

            // Check if we need to perform memory management
            const timeSinceLastInteraction = Date.now() - this.state.lastUserInteraction;
            if (timeSinceLastInteraction > this.config.maxIdleTimeMs) {
                return await this.performMemoryManagement();
            }

            // Perform self-reflection
            return await this.performReflection();

        } catch (error) {
            Logger.error('Error in heartbeat:', error as Error);
            return { type: 'IDLE' };
        }
    }

    private async performReflection(): Promise<HeartbeatResult> {
        const prompt = `As an AI assistant, reflect on your current state and recent interactions:
1. Review recent conversations and identify patterns
2. Consider any pending tasks or commitments
3. Evaluate if any memories need consolidation

Current state:
- Time since last interaction: ${Date.now() - this.state.lastUserInteraction}ms
- Current task: ${this.state.currentTask || 'None'}
- Recent memories: ${await this.getRecentMemoriesSummary()}

What are your thoughts and what actions, if any, should be taken?`;

        const reflection = await this.openAIService.createChatCompletion(prompt);

        return {
            type: 'REFLECTION',
            thoughts: reflection,
            action: this.extractActionFromReflection(reflection)
        };
    }

    private async performMemoryManagement(): Promise<HeartbeatResult> {
        // Trigger memory consolidation
        await this.memoryManager.cleanupMemories();

        return {
            type: 'MEMORY_MANAGEMENT',
            action: 'Performed memory consolidation and cleanup'
        };
    }

    private async getRecentMemoriesSummary(): Promise<string> {
        // Get recent memories from memory manager
        // This is a placeholder - implement based on your memory system
        return 'Recent memory summary...';
    }

    private extractActionFromReflection(reflection: string): string {
        // Parse reflection text to extract specific actions
        // This is a placeholder - implement based on your needs
        return 'Extracted action...';
    }
}