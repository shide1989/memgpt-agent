import { Logger } from '../../../infrastructure/logging/logger.service';
import { MemoryEntity, MemoryCategory } from '../../../infrastructure/persistence/postgres/entities/memory.entity';
import { MemoryRepository } from '../repositories/memory.repository';
import { SummarizationService } from './summarization.service';
import { MemoryOperationResult } from '../value-objects/operation-result.vo';
import { MemoryBuffer } from '../value-objects/memory-buffer.vo';

export interface ConsolidationConfig {
    capacityThreshold: number;     // 0-1 percentage
    minMemoriesForSummary: number; // Minimum memories before summarizing
    targetReduction: number;       // How many memories to remove after summarization
}

export class ConsolidationService {
    constructor(
        private readonly memoryRepository: MemoryRepository,
        private readonly summarizationService: SummarizationService,
        private readonly config: ConsolidationConfig = {
            capacityThreshold: 0.8,
            minMemoriesForSummary: 5,
            targetReduction: 3
        }
    ) { }

    shouldConsolidate(workingMemory: MemoryBuffer): boolean {
        const currentCapacity = workingMemory.getCurrentSize() / workingMemory.getMaxSize();
        return currentCapacity >= this.config.capacityThreshold &&
            workingMemory.getCurrentSize() >= this.config.minMemoriesForSummary;
    }

    async consolidate(workingMemory: MemoryBuffer): Promise<MemoryOperationResult> {
        try {
            Logger.memory('Starting memory consolidation', {
                workingMemorySize: workingMemory.getCurrentSize(),
                targetReduction: this.config.targetReduction
            });

            // Get memories to consolidate
            const memoriesToConsolidate = workingMemory.getEntries()
                .slice(0, this.config.targetReduction);

            // Generate summary
            const summary = await this.summarizationService.summarize(
                memoriesToConsolidate,
                { detailed: true, timeframe: 'recent' }
            );

            // Create consolidated memory in core memory
            const consolidatedMemory = MemoryEntity.create(
                crypto.randomUUID(),
                summary,
                MemoryCategory.CORE,
                0.8, // High importance for consolidated memories
                undefined, // Embedding will be generated on insert
                {
                    consolidatedFrom: memoriesToConsolidate.map(m => m.id)
                }
            );

            // Insert consolidated memory
            await this.memoryRepository.insert(consolidatedMemory);

            // Move consolidated memories to archival
            for (const memory of memoriesToConsolidate) {
                const archivalMemory = MemoryEntity.create(
                    crypto.randomUUID(),
                    memory.content,
                    MemoryCategory.ARCHIVAL,
                    memory.importance,
                    memory.embedding,
                    {
                        ...memory.metadata,
                        archivedAt: Date.now()
                    }
                );

                await this.memoryRepository.insert(archivalMemory);
                await this.memoryRepository.delete(memory.id);
            }

            Logger.memory('Working memory consolidated', {
                memoriesArchived: this.config.targetReduction,
                newWorkingMemorySize: workingMemory.getCurrentSize() - this.config.targetReduction
            });

            return MemoryOperationResult.success('Memory consolidation completed', {
                consolidatedMemory,
                archivedCount: this.config.targetReduction
            });

        } catch (error) {
            Logger.error('Consolidation failed:', error as Error);
            return MemoryOperationResult.failure(
                `Consolidation failed: ${(error as Error).message}`
            );
        }
    }
}