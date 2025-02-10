import { MemoryCategory } from '../../../domain/memory/entities/memory.entity';
import { MemoryManagerService } from '../../../domain/memory/services/memory-manager.service';
import { MemoryOperationResult } from '../../../domain/memory/value-objects/operation-result.vo';

export class SearchMemoryQuery {
    constructor(
        private readonly memoryManager: MemoryManagerService,
        private readonly params: {
            query: string;
            category?: MemoryCategory;
            limit?: number;
            minSimilarity?: number;
        }
    ) { }

    async execute(): Promise<MemoryOperationResult> {
        return this.memoryManager.searchMemory(this.params);
    }
}