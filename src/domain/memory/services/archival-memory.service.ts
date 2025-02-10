import { v4 as uuidv4 } from "uuid";

import { MemoryEntity, MemoryCategory } from "../../../infrastructure/persistence/postgres/entities/memory.entity";
import { MemoryRepository } from "../repositories/memory.repository";

export class ArchivalMemoryService {
    constructor(
        private readonly memoryRepository: MemoryRepository
    ) { }

    async archive(memory: MemoryEntity): Promise<MemoryEntity> {
        const archivalMemory = MemoryEntity.create(
            uuidv4(),
            memory.content,
            MemoryCategory.ARCHIVAL,
            memory.importance,
            memory.embedding,
            {
                ...memory.metadata,
                archivedAt: Date.now(),
                originalId: memory.id  // Track original memory ID
            }
        );

        await this.memoryRepository.insert(archivalMemory);
        return archivalMemory;
    }

    async findRelated(memory: MemoryEntity, limit: number = 5): Promise<MemoryEntity[]> {
        return this.memoryRepository.semanticSearch(memory.embedding!, limit);
    }
}