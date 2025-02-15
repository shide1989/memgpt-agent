import OpenAI from 'openai';
import { MemoryEntity } from '../../../infrastructure/persistence/postgres/entities/memory.entity';
import { Logger } from '../../../infrastructure/logging/logger.service';
import { OpenAIService } from '../../../infrastructure/llms/openai.service';

export class SummarizationService {

    constructor(private readonly openAiService: OpenAIService) { }

    async summarize(
        memories: MemoryEntity[],
        options: { detailed?: boolean; timeframe?: string } = {}
    ): Promise<string> {
        try {
            Logger.memory('Summarizing memories', { count: memories.length });

            if (memories.length === 0) {
                return '';
            }

            const sortedMemories = memories
                .sort((a, b) => b.importance - a.importance)
                .map(m => ({
                    content: m.content,
                    timestamp: new Date(m.timestamp).toISOString(),
                    importance: m.importance
                }));

            const prompt = this.createPrompt(sortedMemories, options);
            const response = await this.openAiService.createChatCompletion([{
                role: 'system',
                content: prompt
            }]);

            return response.content ?? '';
        } catch (error) {
            Logger.error('Summarization failed:', error as Error);
            throw error;
        }
    }

    private createPrompt(
        memories: Array<{ content: string; timestamp: string; importance: number }>,
        options: { detailed?: boolean; timeframe?: string }
    ): string {
        const memoryText = memories
            .map(m => `[${m.timestamp}] (Importance: ${m.importance}) ${m.content}`)
            .join('\n');

        return `Summarize the following memories${options.timeframe ? ` from ${options.timeframe}` : ''}. 
${options.detailed ? 'Provide a detailed summary with key points and patterns.' : 'Provide a concise summary of the main points.'}

Focus on:
1. Most important information (based on importance scores)
2. Key patterns and themes
3. Critical insights
4. Temporal relationships between memories

Memories to summarize:
${memoryText}

${options.detailed ? 'Provide a detailed analysis and summary.' : 'Provide a brief, focused summary.'}`;
    }
}