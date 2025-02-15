import { Logger } from '../../../infrastructure/logging/logger.service';
import { MemoryEntity, MemoryCategory } from '../../../infrastructure/persistence/postgres/entities/memory.entity';
import { MemoryRepository } from '../../../domain/memory/repositories/memory.repository';
import { SummarizationService } from '../../../domain/memory/services/summarization.service';
import { MemoryOperationResult } from '../../../domain/memory/value-objects/operation-result.vo';
import { MemoryBuffer } from '../../../domain/memory/value-objects/memory-buffer.vo';

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

            // Get memories that need consolidation based on criteria
            const memoriesToConsolidate = this.selectMemoriesForConsolidation(workingMemory);

            if (memoriesToConsolidate.length === 0) {
                return MemoryOperationResult.success('No memories need consolidation');
            }

            // Generate summary
            const summary = await this.summarizationService.summarize(
                memoriesToConsolidate,
                {
                    detailed: true,
                    timeframe: 'recent',
                    perspective: 'reflective',
                    focus: 'patterns'
                }
            );

            // Add reflective summary
            // const reflection = await this.summarizationService.createReflectiveSummary(
            //     memoriesToConsolidate,
            //     workingMemory.getEntries()
            //         .slice(-5)
            //         .map(m => m.content)
            //         .join('\n')
            // );

            // Create consolidated memory
            const consolidatedMemory = MemoryEntity.create(
                crypto.randomUUID(),
                summary,
                MemoryCategory.CORE,
                0.8, // High importance for consolidated memories
                undefined,
                {
                    type: 'consolidation',
                    consolidatedFrom: memoriesToConsolidate.map(m => m.id),
                    consolidationTimestamp: Date.now()
                }
            );

            // Update importance scores
            const importance = await this.summarizationService.createImportanceAnalysis(consolidatedMemory);
            consolidatedMemory.importance = importance;


            // Insert consolidated memory
            await this.memoryRepository.insert(consolidatedMemory);

            // Archive consolidated memories
            await this.archiveMemories(memoriesToConsolidate);

            Logger.memory('Consolidation complete', {
                consolidatedCount: memoriesToConsolidate.length,
                summaryLength: summary.length
            });

            return MemoryOperationResult.success(
                `Consolidated ${memoriesToConsolidate.length} memories`,
                { consolidatedMemory }
            );

        } catch (error) {
            Logger.error('Consolidation failed:', error as Error);
            return MemoryOperationResult.failure(
                `Consolidation failed: ${(error as Error).message}`
            );
        }
    }

    private selectMemoriesForConsolidation(workingMemory: MemoryBuffer): MemoryEntity[] {
        return workingMemory.getEntries()
            .filter(memory => {
                const age = Date.now() - memory.timestamp;
                const ageInDays = age / (24 * 60 * 60 * 1000);

                return (
                    ageInDays > 1 || // Older than 24 hours
                    memory.importance < 0.3 || // Low importance
                    this.evaluateImportance(memory) < 0.4 // Low composite score
                );
            })
            .slice(0, this.config.targetReduction);
    }

    private async archiveMemories(memories: MemoryEntity[]): Promise<void> {
        for (const memory of memories) {
            const archivalMemory = MemoryEntity.create(
                crypto.randomUUID(),
                memory.content,
                MemoryCategory.ARCHIVAL,
                memory.importance,
                memory.embedding,
                {
                    ...memory.metadata,
                    archivedAt: Date.now(),
                    originalCategory: memory.category
                }
            );

            await this.memoryRepository.insert(archivalMemory);
            await this.memoryRepository.delete(memory.id);
        }
    }

    private evaluateImportance(memory: MemoryEntity): number {
        const factors = {
            age: 0.3,
            accessCount: 0.2,
            explicitImportance: 0.5
        };

        const ageScore = Math.exp(-(Date.now() - memory.timestamp) / (7 * 24 * 60 * 60 * 1000));
        const accessScore = Math.min(memory.accessCount / 10, 1);

        return (
            ageScore * factors.age +
            accessScore * factors.accessCount +
            memory.importance * factors.explicitImportance
        );
    }
}