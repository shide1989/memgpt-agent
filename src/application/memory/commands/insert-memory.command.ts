import { MemoryCategory, MemoryMetadata } from '../../../domain/memory/entities/memory.entity';
import { MemoryManagerService } from '../../../domain/memory/services/memory-manager.service';
// import { MemoryOperationResult } from '../../../types/memory.interface';

export class InsertMemoryCommand {
    constructor(
        private readonly memoryManager: MemoryManagerService,
        private readonly params: {
            content: string;
            category: MemoryCategory;
            importance?: number;
            metadata?: Partial<MemoryMetadata>;
        }
    ) { }

    async execute() {
        return this.memoryManager.insertMemory(
            this.params.content,
            this.params.category,
            this.params.importance,
            this.params.metadata
        );
    }
}