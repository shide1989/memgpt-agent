import OpenAI from 'openai';
import { Logger } from '../../services/logger.service';

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

    async createChatCompletion(prompt: string): Promise<string> {
        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{
                    role: 'system',
                    content: prompt
                }],
                temperature: 0.7,
                max_tokens: 500
            });

            return completion.choices[0].message.content || '';
        } catch (error) {
            Logger.error('OpenAI chat completion failed:');
            throw error;
        }
    }
}