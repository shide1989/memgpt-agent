import OpenAI from 'openai';
import { Logger } from '../../services/logger.service';

export class OpenAIService {
    protected openai: OpenAI;

    constructor(apiKey?: string) {
        this.openai = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY
        });
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