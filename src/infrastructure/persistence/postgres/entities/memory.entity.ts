import { MemoryMetadata } from "../../../../application/memory/interfaces/memory.interface";

export enum MemoryCategory {
    CORE = 'core',
    WORKING = 'working',
    ARCHIVAL = 'archival'
}

export class MemoryEntity {
    constructor(
        public readonly id: string,
        public readonly content: string,
        public readonly category: MemoryCategory,
        public importance: number,
        public readonly timestamp: number,
        public readonly embedding?: number[],
        public readonly metadata: MemoryMetadata = {},
        public readonly accessCount: number = 0,
        public readonly lastAccessed: number = Date.now()
    ) { }

    static create(
        id: string,
        content: string,
        category: MemoryCategory,
        importance: number,
        embedding?: number[],
        metadata?: Partial<MemoryMetadata>
    ): MemoryEntity {
        return new MemoryEntity(
            id,
            content,
            category,
            importance,
            Date.now(),
            embedding,
            metadata
        );
    }
}