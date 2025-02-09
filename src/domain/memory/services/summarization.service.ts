import OpenAI from 'openai';
import { Memory } from '../entities/memory.entity';
import { Logger } from '../../../services/logger.service';

export class SummarizationService {
    constructor(private readonly openai: OpenAI) { }

    async summarize(
        memories: Memory[],
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
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.7,
                max_tokens: 500
            });

            return completion.choices[0].message.content || '';
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