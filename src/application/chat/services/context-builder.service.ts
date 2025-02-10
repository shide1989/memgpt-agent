import { CompilationService } from '../../../domain/memory/services/compilation.service';
import { MemoryBuffer } from '../../../domain/memory/value-objects';
import { MemoryCategory } from '../../../infrastructure/persistence/postgres/entities/memory.entity';

export class ContextBuilderService {
    private readonly compilationService: CompilationService;
    constructor() {
        this.compilationService = new CompilationService();
    }

    /**
     * Builds a context string for the agent based on current memories
     * Combines core knowledge, recent context, and relevant memories
     */
    buildContext(memories: MemoryBuffer): string {
        const context = this.compilationService.compile(memories, 'SIMPLE_TEMPLATE');
        return context;
    }

    /**
     * Builds a focused context for a specific task or query
     */
    buildTaskContext(memories: MemoryBuffer, query: string): string {
        const relevantMemories = new MemoryBuffer(memories.getMaxSize());

        // Filter memories relevant to the task
        memories.getEntries()
            .filter(memory =>
                memory.category === MemoryCategory.CORE ||
                memory.content.toLowerCase().includes(query.toLowerCase()))
            .forEach(memory => relevantMemories.add(memory));

        const context = this.compilationService.compile(relevantMemories, 'TASK_CONTEXT');
        return context;
    }
}