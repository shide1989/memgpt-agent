import OpenAI from 'openai';
import { Logger } from '../logging/logger.service';

export type ChatResponse = {
    content: string | null;
    tool_calls?: {
        name: string;
        arguments: string;
    }[];
}

export class OpenAIService {
    protected openai: OpenAI;

    constructor(apiKey?: string) {
        this.openai = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY
        });

        if (!this.openai.apiKey) {
            throw new Error('OpenAI API key not provided');
        }
    }

    async getEmbedding(text: string): Promise<number[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: text.slice(0, 8191)  // OpenAI's token limit
            });

            Logger.memory('Generated embedding', {
                textLength: text.length,
                embeddingSize: response.data[0].embedding.length
            });

            return response.data[0].embedding;
        } catch (error) {
            Logger.error('Failed to generate embedding:');
            throw new Error(`Embedding generation failed: ${(error as Error).message}`);
        }
    }

    async createChatCompletion(
        messages: Array<any>,
        options: {
            temperature?: number;
            max_tokens?: number;
            functions?: any[];
            function_call?: 'auto' | 'none';
        } = {}
    ): Promise<ChatResponse> {
        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens ?? 1000,
                functions: options.functions,
                function_call: options.function_call
            });

            const message = completion.choices[0].message;
            const functions = message.tool_calls?.map(call => ({
                name: call.function.name,
                arguments: call.function.arguments
            }));
            return {
                content: message.content,
                tool_calls: functions
            };
        } catch (error) {
            Logger.error('OpenAI chat completion failed:');
            throw error;
        }
    }
}