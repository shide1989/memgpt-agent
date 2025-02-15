import { OpenAIService } from '../../../infrastructure/openai/openai.service';
import { MemoryEntity } from '../../../infrastructure/persistence/postgres/entities/memory.entity';
import { Logger } from '../../../infrastructure/logging/logger.service';

interface SummarizationOptions {
    detailed?: boolean;
    timeframe?: string;
    perspective?: 'objective' | 'reflective';
    focus?: 'key_points' | 'patterns' | 'insights';
}

export class SummarizationService {
    constructor(private readonly openAiService: OpenAIService) { }

    async summarize(
        memories: MemoryEntity[],
        options: SummarizationOptions = {}
    ): Promise<string> {
        try {
            Logger.memory('Summarizing memories', { count: memories.length });

            if (memories.length === 0) {
                return '';
            }

            const sortedMemories = this.prepareMemoriesForSummarization(memories);
            const prompt = this.createSummarizationPrompt(sortedMemories, options);

            return await this.openAiService.createChatCompletion(prompt);
        } catch (error) {
            Logger.error('Summarization failed:', error as Error);
            throw error;
        }
    }

    private prepareMemoriesForSummarization(memories: MemoryEntity[]): any[] {
        return memories
            .sort((a, b) => b.importance - a.importance)
            .map(m => ({
                content: m.content,
                timestamp: new Date(m.timestamp).toISOString(),
                importance: m.importance,
                category: m.category,
                metadata: m.metadata
            }));
    }

    private createSummarizationPrompt(
        memories: any[],
        options: SummarizationOptions
    ): string {
        const { detailed = false, timeframe = 'recent', perspective = 'objective', focus = 'key_points' } = options;

        const memoryContext = memories
            .map(m => `[${m.timestamp}] (Importance: ${m.importance}) ${m.content}`)
            .join('\n');

        return `As an AI with advanced memory capabilities, analyze and summarize the following memories:

${memoryContext}

Create a ${detailed ? 'detailed' : 'concise'} summary from a ${perspective} perspective, focusing on ${focus}.
Consider the following aspects:

1. Key information and insights
2. Patterns or recurring themes
3. Important relationships or connections
4. Emotional or contextual significance
5. Potential implications or future relevance

The summary should:
- Preserve critical information
- Highlight patterns and insights
- Maintain contextual relevance
- ${detailed ? 'Include specific details and examples' : 'Focus on core messages'}
- Consider the ${timeframe} timeframe context

Format the summary to be clear and structured, suitable for future reference.`;
    }

    async createReflectiveSummary(
        memories: MemoryEntity[],
        currentContext: string
    ): Promise<string> {
        const prompt = `As an AI engaging in self-reflection, analyze these memories in the current context:

Context: ${currentContext}

Memories:
${memories.map(m => `- ${m.content}`).join('\n')}

Reflect on:
1. How these memories relate to current context
2. Patterns in behavior or thinking
3. Important insights or learnings
4. Potential areas for improvement
5. Relevant connections or implications

Provide a reflective summary that captures both factual content and deeper insights.`;

        return await this.openAiService.createChatCompletion(prompt);
    }

    async createImportanceAnalysis(memory: MemoryEntity): Promise<number> {
        const prompt = `Analyze the following memory and rate its importance (0.0-1.0):
    
Content: ${memory.content}
Category: ${memory.category}
Type: ${memory.metadata?.type || 'standard'}
Timestamp: ${new Date(memory.timestamp).toISOString()}

Consider:
1. Long-term relevance
2. Emotional significance
3. Practical utility
4. Uniqueness of information
5. Relationship to core knowledge

Provide ONLY a single number between 0.0 and 1.0 representing the memory's importance.
DO NOT PROSE OR COMMENT.`;

        const response = await this.openAiService.createChatCompletion(prompt);
        const importance = parseFloat(response);

        return isNaN(importance) ? 0.5 : Math.max(0, Math.min(1, importance));
    }
}