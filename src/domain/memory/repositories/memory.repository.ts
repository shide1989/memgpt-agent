import { MemoryEntity, MemoryCategory } from '../entities/memory.entity';

export interface MemoryRepository {
    insert(memory: MemoryEntity): Promise<void>;
    findById(id: string): Promise<MemoryEntity | null>;
    findByCategory(category: MemoryCategory): Promise<MemoryEntity[]>;
    semanticSearch(embedding: number[], limit?: number, category?: MemoryCategory): Promise<MemoryEntity[]>;
    updateAccessCount(id: string): Promise<void>;
    delete(id: string): Promise<void>;
}