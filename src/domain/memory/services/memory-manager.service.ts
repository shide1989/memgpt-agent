import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryCategory, MemoryMetadata } from '../entities/memory.entity';
import { MemoryBuffer } from '../value-objects/memory-buffer.vo';
import { MemoryRepository } from '../repositories/memory.repository';
import { EmbeddingService } from '../../../infrastructure/openai/embedding.service';
import { ConsolidationService } from './consolidation.service';
import { SummarizationService } from './summarization.service';
import { Logger } from '../../../services/logger.service';
import { SearchParams, SearchService } from './search.service';
import { MemoryOperationResult } from '../value-objects/operation-result.vo';

export class MemoryManagerService {
    private workingMemory: MemoryBuffer;
    private coreMemory: MemoryBuffer;
    private archivalMemories: Memory[] = [];

    constructor(
        private readonly memoryRepository: MemoryRepository,
        private readonly embeddingService: EmbeddingService,
        private readonly consolidationService: ConsolidationService,
        private readonly summarizationService: SummarizationService,
        private readonly searchService: SearchService,
        workingMemorySize: number = 10,
        coreMemorySize: number = 5
    ) {
        this.workingMemory = new MemoryBuffer(workingMemorySize);
        this.coreMemory = new MemoryBuffer(coreMemorySize);
    }

    async loadMemories(): Promise<void> {
        try {
            const [working, core, archival] = await Promise.all([
                this.memoryRepository.findByCategory(MemoryCategory.WORKING),
                this.memoryRepository.findByCategory(MemoryCategory.CORE),
                this.memoryRepository.findByCategory(MemoryCategory.ARCHIVAL)
            ]);

            working.forEach(m => this.workingMemory.add(m));
            core.forEach(m => this.coreMemory.add(m));
            this.archivalMemories = archival;

            Logger.memory('Memories loaded', {
                working: this.workingMemory.getCurrentSize(),
                core: this.coreMemory.getCurrentSize(),
                archival: this.archivalMemories.length
            });
        } catch (error) {
            Logger.error('Failed to load memories');
            throw error;
        }
    }

    async insertMemory(
        content: string,
        category: MemoryCategory,
        importance: number = 0.5,
        metadata: Partial<MemoryMetadata> = {}
    ): Promise<Memory> {
        const embedding = await this.embeddingService.getEmbedding(content);

        const memory = Memory.create(
            uuidv4(),
            content,
            category,
            importance,
            embedding,
            metadata
        );

        await this.memoryRepository.insert(memory);

        switch (category) {
            case MemoryCategory.WORKING:
                await this.handleWorkingMemoryInsertion(memory);
                break;
            case MemoryCategory.CORE:
                await this.handleCoreMemoryInsertion(memory);
                break;
            case MemoryCategory.ARCHIVAL:
                this.archivalMemories.push(memory);
                break;
        }

        return memory;
    }

    private async handleWorkingMemoryInsertion(memory: Memory): Promise<void> {
        if (this.workingMemory.isFull()) {
            const leastImportant = this.workingMemory.findLeastImportant();
            if (leastImportant) {
                await this.moveToArchival(leastImportant);
                this.workingMemory.remove(leastImportant.id);
            }
        }

        this.workingMemory.add(memory);
        await this.checkWorkingMemoryCapacity();
    }

    private async handleCoreMemoryInsertion(memory: Memory): Promise<void> {
        if (this.coreMemory.isFull()) {
            const leastImportant = this.coreMemory.findLeastImportant();
            if (leastImportant && memory.importance > leastImportant.importance) {
                await this.moveToArchival(leastImportant);
                this.coreMemory.remove(leastImportant.id);
                this.coreMemory.add(memory);
            }
        } else {
            this.coreMemory.add(memory);
        }
    }

    private async moveToArchival(memory: Memory): Promise<void> {
        const archivalMemory = Memory.create(
            uuidv4(),
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
        this.archivalMemories.push(archivalMemory);
    }

    private async checkWorkingMemoryCapacity(): Promise<void> {
        if (this.consolidationService.shouldConsolidate(this.workingMemory)) {
            await this.consolidationService.consolidate(
                this.workingMemory,
                // this.coreMemory,
                // this.archivalMemories
            );
        }
    }

    async searchMemory(params: SearchParams): Promise<MemoryOperationResult<Memory[]>> {
        return this.searchService.search(params);
    }
}