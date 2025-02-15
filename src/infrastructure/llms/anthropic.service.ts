import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '../logging/logger.service';
import { Message, ToolCall } from '../../application/chat/interfaces/chat.interface';

export type AnthropicResponse = {
    content: string | null;
    tool_calls?: ToolCall[];
}

export class AnthropicService {
    protected client: Anthropic;
    protected defaultModel = 'claude-3-sonnet-20240229';

    constructor(apiKey?: string) {
        this.client = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY
        });

        if (!this.client.apiKey) {
            throw new Error('Anthropic API key not provided');
        }
    }

    async createChatCompletion(
        messages: Message[],
        options: {
            temperature?: number;
            max_tokens?: number;
            tools?: any[];
            tool_choice?: 'auto' | 'none';
        } = {}
    ): Promise<AnthropicResponse> {
        try {
            // Convert our standard messages to Anthropic format
            const anthropicMessages = this.convertToAnthropicMessages(messages);

            const completion = await this.client.messages.create({
                model: this.defaultModel,
                messages: anthropicMessages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens ?? 1000,
                system: this.extractSystemPrompt(messages),
                tools: options.tools,
            });

            const content = completion.content[0]

            if (content.type === 'text') {
                return {
                    content: content.text,
                };
            }

            if (content.type === 'tool_use') {
                return {
                    content: content.id,
                    tool_calls: [
                        {
                            arguments: content.input as any,
                            name: content.name
                        }
                    ]
                };
            }

            throw new Error('Unexpected response from Anthropic');
        } catch (error) {
            Logger.error('Anthropic chat completion failed');
            throw error;
        }
    }

    private convertToAnthropicMessages(messages: Message[]): any[] {
        return messages
            .filter(msg => msg.role !== 'system') // System message handled separately
            .map(msg => {
                if (msg.role === 'tool') {
                    return {
                        role: 'assistant',
                        content: `Function ${msg.name} returned: ${msg.content}`
                    };
                }
                return {
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                };
            });
    }

    private extractSystemPrompt(messages: Message[]): string | undefined {
        const systemMessage = messages.find(msg => msg.role === 'system');
        return systemMessage?.content || undefined;
    }

    async getEmbedding(text: string): Promise<number[]> {
        try {
            // Note: As of now, Claude doesn't have a direct embedding API
            // You might want to use OpenAI's embedding API or another service
            throw new Error('Embedding functionality not yet implemented for Anthropic');
        } catch (error) {
            Logger.error('Failed to generate embedding:');
            throw new Error(`Embedding generation failed: ${(error as Error).message}`);
        }
    }
}