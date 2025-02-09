import { Memory, MemoryCategory } from '../entities/memory.entity';

export interface MemoryRepository {
    insert(memory: Memory): Promise<void>;
    findById(id: string): Promise<Memory | null>;
    findByCategory(category: MemoryCategory): Promise<Memory[]>;
    semanticSearch(embedding: number[], limit?: number): Promise<Memory[]>;
    updateAccessCount(id: string): Promise<void>;
    delete(id: string): Promise<void>;
}