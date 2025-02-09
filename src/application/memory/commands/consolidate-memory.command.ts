import { ConsolidationService } from '../../../domain/memory/services/consolidation.service';
import { MemoryOperationResult } from '../../../domain/memory/value-objects/operation-result.vo';
import { MemoryBuffer } from '../../../domain/memory/value-objects/memory-buffer.vo';

export class ConsolidateMemoryCommand {
    constructor(
        private readonly consolidationService: ConsolidationService,
    ) { }

    async execute(): Promise<MemoryOperationResult> {
        const workingMemory = new MemoryBuffer(10); // 10 is default size

        // Check if consolidation is needed
        if (!this.consolidationService.shouldConsolidate(workingMemory)) {
            return MemoryOperationResult.success('Consolidation not needed');
        }

        // Perform consolidation
        return await this.consolidationService.consolidate(workingMemory);
    }
}