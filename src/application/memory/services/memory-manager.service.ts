import { v4 as uuidv4 } from 'uuid';

import { MemoryEntity } from '../../../infrastructure/persistence/postgres/entities/memory.entity';
import { ConsolidationConfig, ConsolidationService } from '../../../domain/memory/services/consolidation.service';
import { SearchService } from '../../../domain/memory/services/search.service';
import { SummarizationService } from '../../../domain/memory/services/summarization.service';
import { MemoryBuffer } from '../../../domain/memory/value-objects';
import { Logger } from '../../../infrastructure/logging/logger.service';
import { OpenAIService } from '../../../infrastructure/openai/openai.service';
import { PostgresMemoryRepository } from '../../../infrastructure/persistence/postgres/repositories/postgres-memory.repository';
import {
    MemoryCategory,
    MemoryMetadata,
    MemoryOperationResult,
    MemorySearchParams
} from '../interfaces/memory.interface';

const consolidationConfig: ConsolidationConfig = {
    capacityThreshold: 0.8,
    minMemoriesForSummary: 5,
    targetReduction: 3
}

export class MemoryManager {
    private openAiService: OpenAIService;
    private consolidationService: ConsolidationService;
    private workingMemory: MemoryBuffer;
    private coreMemory: MemoryBuffer;
    private archivalMemory: MemoryEntity[];
    // private memoryStore: MemoryStore;
    private memoryRepository: PostgresMemoryRepository;
    private searchService: SearchService;

    constructor(
        workingMemorySize: number = 10,
        coreMemorySize: number = 5,
    ) {
        // this.memoryStore = new MemoryStore();
        this.openAiService = new OpenAIService();
        // Initialize memory buffers
        this.workingMemory = new MemoryBuffer(workingMemorySize);

        // Initialize MemoryRepository
        this.memoryRepository = new PostgresMemoryRepository()
        this.consolidationService = new ConsolidationService(
            this.memoryRepository,
            new SummarizationService(this.openAiService),
            consolidationConfig
        );
        this.searchService = new SearchService(this.memoryRepository, this.openAiService);

        this.coreMemory = new MemoryBuffer(coreMemorySize);

        this.archivalMemory = [];
    }

    async loadMemoriesFromDB(): Promise<void> {
        try {
            // Load and map working memories
            const workingMemories = await this.memoryRepository.findByCategory(MemoryCategory.WORKING);
            Logger.memory('Loading working memories', { count: workingMemories.length });
            workingMemories.forEach(wm => {
                this.workingMemory.add({
                    ...wm,
                    embedding: wm.embedding as number[] ?? null,
                    category: wm.category as MemoryCategory,
                    metadata: wm.metadata as any,
                });
            });

            // Apply same mapping for core and archival
            const coreMemories = await this.memoryRepository.findByCategory(MemoryCategory.CORE);
            Logger.memory('Loading core memories', { count: coreMemories.length });
            coreMemories.forEach(cm => {
                this.coreMemory.add({
                    ...cm,
                    embedding: cm.embedding as number[] ?? null,
                    category: cm.category as MemoryCategory,
                    metadata: cm.metadata as any,
                });
            });


            const archivalMemories = await this.memoryRepository.findByCategory(MemoryCategory.ARCHIVAL);
            archivalMemories.forEach(am => {
                this.archivalMemory.push({
                    ...am,
                    embedding: am.embedding as number[] ?? null,
                    category: am.category as MemoryCategory,
                    metadata: am.metadata as any,
                });
            });

        } catch (error) {
            Logger.error('Failed to load memories from database:');
            throw error;
        }
    }

    public getCoreMemory(): MemoryBuffer {
        return this.coreMemory;
    }

    public getWorkingMemory(): MemoryBuffer {
        return this.workingMemory;
    }

    public async insertMemory(
        content: string,
        category: MemoryCategory,
        importance: number = 0.5,
        metadata: Partial<MemoryMetadata> = {}
    ): Promise<MemoryOperationResult> {
        try {
            // Generate embedding for the content
            const embedding = await this.openAiService.getEmbedding(content);

            const entry: MemoryEntity = {
                id: uuidv4(),
                content,
                timestamp: Date.now(),
                importance,
                category,
                embedding,
                lastAccessed: Date.now(),
                accessCount: 0,
                metadata: {
                    ...metadata
                }
            };

            Logger.memory('Inserting with embedding', {
                category,
                content: content.substring(0, 50) + '...',
                embeddingSize: embedding.length
            });

            let result: MemoryOperationResult;
            switch (category) {
                case MemoryCategory.WORKING:
                    result = await this.insertWorkingMemory(entry);
                    // Check capacity after inserting to working memory

                    if (this.consolidationService.shouldConsolidate(this.workingMemory)) {
                        const currentCapacity = this.workingMemory.getCurrentSize() / this.workingMemory.getMaxSize();
                        Logger.memory('Working memory capacity threshold reached', {
                            capacity: `${(currentCapacity * 100).toFixed(1)}%`,
                            memoryCount: this.workingMemory.getCurrentSize()
                        });
                        await this.consolidationService.consolidate(this.workingMemory);
                    }
                    break;
                case MemoryCategory.CORE:
                    result = await this.insertCoreMemory(entry);
                    break;
                case MemoryCategory.ARCHIVAL:
                    result = await this.insertArchivalMemory(entry);
                    break;
                default:
                    throw new Error('Invalid memory category');
            }

            Logger.memoryState(this);
            return result;
        } catch (error) {
            Logger.error(error as Error);
            return {
                success: false,
                message: `Failed to insert memory: ${(error as Error).message}`
            };
        }
    }

    private async insertWorkingMemory(entry: MemoryEntity): Promise<MemoryOperationResult> {
        if (this.workingMemory.getCurrentSize() >= this.workingMemory.getMaxSize()) {
            const leastImportant = this.findLeastImportantMemory(this.workingMemory.getEntries());

            // Move to archival
            await this.memoryRepository.insert({
                ...leastImportant,
                category: MemoryCategory.ARCHIVAL,
                metadata: {
                    ...leastImportant.metadata,
                    archivedAt: Date.now()
                }
            });

            // Remove from working memory
            this.workingMemory.remove(leastImportant.id);
        }

        // Insert into database and working memory
        await this.memoryRepository.insert(entry);
        this.workingMemory.add(entry);

        return {
            success: true,
            message: 'Memory inserted into working memory',
            data: entry
        };
    }

    private async insertCoreMemory(entry: MemoryEntity): Promise<MemoryOperationResult> {
        if (this.coreMemory.getCurrentSize() >= this.coreMemory.getMaxSize()) {
            const leastImportant = this.findLeastImportantMemory(this.coreMemory.getEntries());
            if (entry.importance > leastImportant.importance) {
                // Move to archival
                await this.memoryRepository.insert({
                    ...leastImportant,
                    category: MemoryCategory.ARCHIVAL,
                    metadata: {
                        ...leastImportant.metadata,
                        archivedAt: Date.now()
                    }
                });

                // Remove from core memory
                this.coreMemory.remove(leastImportant.id);

                // Insert new entry
                await this.memoryRepository.insert(entry);
                this.coreMemory.add(entry);

                return {
                    success: true,
                    message: 'Memory inserted into core memory, replaced least important entry',
                    data: entry
                };
            }
            return {
                success: false,
                message: 'Core memory full and new memory not important enough'
            };
        }

        // Insert into database and core memory
        await this.memoryRepository.insert(entry);
        this.coreMemory.add(entry);

        return {
            success: true,
            message: 'Memory inserted into core memory',
            data: entry
        };
    }

    private async insertArchivalMemory(entry: MemoryEntity): Promise<MemoryOperationResult> {
        await this.memoryRepository.insert(entry);
        this.archivalMemory.push(entry);
        return {
            success: true,
            message: 'Memory inserted into archival memory',
            data: entry
        };
    }

    public async searchMemory(params: MemorySearchParams): Promise<MemoryOperationResult> {
        try {
            const { query, category, limit = 5 } = params;

            // Use MemoryStore for semantic search
            let results = await this.searchService.search(params);

            // Update access counts for found memories
            for (const memory of results) {
                await this.memoryRepository.updateAccessCount(memory.id);
            }

            Logger.memory('Semantic search completed', {
                query,
                resultsCount: results.length
            });

            return {
                success: true,
                message: `Found ${results.length} matching memories`,
                data: results
            };
        } catch (error) {
            Logger.error(error as Error);
            return {
                success: false,
                message: `Search failed: ${(error as Error).message}`
            };
        }
    }

    private findLeastImportantMemory(memories: MemoryEntity[]): MemoryEntity {
        return memories.reduce((min, current) =>
            current.importance < min.importance ? current : min
        );
    }

    public async cleanupMemories(threshold: number = 30): Promise<MemoryOperationResult> {
        try {
            const now = Date.now();
            const dayInMs = 24 * 60 * 60 * 1000;
            const originalCount = this.archivalMemory.length;

            Logger.memory('Starting cleanup', { threshold: `${threshold} days`, originalCount });

            this.archivalMemory = this.archivalMemory.filter(memory => {
                const keepMemory = memory.importance > 0.7 ||
                    (now - memory.timestamp) < (threshold * dayInMs);

                if (!keepMemory) {
                    Logger.memory('Removing memory', {
                        content: memory.content.substring(0, 50),
                        age: Math.floor((now - memory.timestamp) / dayInMs)
                    });
                }
                return keepMemory;
            });

            const removedCount = originalCount - this.archivalMemory.length;

            return {
                success: true,
                message: `Cleaned up ${removedCount} memories`,
                data: { removedCount, remainingCount: this.archivalMemory.length }
            };
        } catch (error) {
            Logger.error(error as Error);
            return {
                success: false,
                message: `Cleanup failed: ${(error as Error).message}`
            };
        }
    }
}