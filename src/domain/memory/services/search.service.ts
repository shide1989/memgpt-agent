import { OpenAIService } from '../../../infrastructure/llms/openai.service';
import { Logger } from '../../../infrastructure/logging/logger.service';
import { MemoryCategory, MemoryEntity } from '../../../infrastructure/persistence/postgres/entities/memory.entity';
import { MemoryRepository } from '../repositories/memory.repository';

export interface SearchParams {
    query: string;
    embedding?: number[];
    category?: MemoryCategory;
    limit?: number;
    minSimilarity?: number;
    searchStrategy?: 'hierarchical' | 'single-category';
}

export class SearchService {
    constructor(
        private readonly memoryRepository: MemoryRepository,
        private readonly openAiService: OpenAIService
    ) { }

    async search(params: SearchParams): Promise<MemoryEntity[]> {
        try {
            const {
                query,
                embedding,
                category,
                limit = 5,
                searchStrategy = 'single-category'
            } = params;

            // Get embedding either from query or use provided embedding
            const searchEmbedding = embedding ||
                (query ? await this.openAiService.getEmbedding(query) : null);

            if (!searchEmbedding) {
                // return MemoryOperationResult.failure('No search criteria provided');
                Logger.warn('No search criteria provided');
                return []
            }

            let results: MemoryEntity[] = [];

            if (searchStrategy === 'hierarchical') {
                results = await this.hierarchicalSearch(searchEmbedding, limit);
            } else {
                results = await this.memoryRepository.semanticSearch(
                    searchEmbedding,
                    limit,
                    category
                );
            }

            Logger.memory('Search completed', {
                strategy: searchStrategy,
                category,
                resultsCount: results.length
            });

            return results
        } catch (error) {
            Logger.error('Search failed:', error as Error);
            return []
        }
    }

    private async hierarchicalSearch(embedding: number[], limit: number): Promise<MemoryEntity[]> {
        // Search in order: Core -> Working -> Archival
        const results: MemoryEntity[] = [];

        // Search core memories first
        const coreMemories = await this.memoryRepository.semanticSearch(
            embedding,
            limit,
            MemoryCategory.CORE
        );
        results.push(...coreMemories);

        if (results.length < limit) {
            // Search working memories next
            const workingMemories = await this.memoryRepository.semanticSearch(
                embedding,
                limit - results.length,
                MemoryCategory.WORKING
            );
            results.push(...workingMemories);
        }

        if (results.length < limit) {
            // Search archival memories last
            const archivalMemories = await this.memoryRepository.semanticSearch(
                embedding,
                limit - results.length,
                MemoryCategory.ARCHIVAL
            );
            results.push(...archivalMemories);
        }

        return results;
    }
}