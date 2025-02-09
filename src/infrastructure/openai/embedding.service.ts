import { OpenAIService } from './openai.service';
import { Logger } from '../../services/logger.service';

export class EmbeddingService extends OpenAIService {
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
}