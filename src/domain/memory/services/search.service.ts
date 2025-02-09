import { Logger } from '../../../services/logger.service';
import { Memory } from '../entities/memory.entity';
import { MemoryOperationResult } from '../value-objects/operation-result.vo';
import { MemoryRepository } from '../repositories/memory.repository';
import { EmbeddingService } from '../../../infrastructure/openai/embedding.service';

export interface SearchParams {
    query: string;
    category?: string;
    limit?: number;
    minSimilarity?: number;
}

export class SearchService {
    constructor(
        private readonly memoryRepository: MemoryRepository,
        private readonly embeddingService: EmbeddingService
    ) { }

    async search(params: SearchParams): Promise<MemoryOperationResult<Memory[]>> {
        try {
            const { query, category, limit = 5 } = params;

            // Generate embedding for search query
            const queryEmbedding = await this.embeddingService.getEmbedding(query);

            // Perform semantic search
            let results = await this.memoryRepository.semanticSearch(queryEmbedding, limit);

            // Filter by category if specified
            if (category) {
                results = results.filter(memory => memory.category === category);
            }

            // Update access counts
            await Promise.all(
                results.map(memory =>
                    this.memoryRepository.updateAccessCount(memory.id)
                )
            );

            Logger.memory('Semantic search completed', {
                query,
                category,
                resultsCount: results.length
            });

            return MemoryOperationResult.success(
                `Found ${results.length} matching memories`,
                results
            );
        } catch (error) {
            Logger.error('Search failed:', error as Error);
            return MemoryOperationResult.failure(
                `Search failed: ${(error as Error).message}`
            );
        }
    }
}