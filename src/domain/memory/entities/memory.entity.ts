export enum MemoryCategory {
    CORE = 'core',
    WORKING = 'working',
    ARCHIVAL = 'archival'
}

export interface MemoryMetadata {
    lastAccessed?: number;
    accessCount: number;
    consolidatedFrom?: string[];
    associations?: string[];
    archivedAt?: number;
}

export class Memory {
    constructor(
        public readonly id: string,
        public readonly content: string,
        public readonly category: MemoryCategory,
        public readonly importance: number,
        public readonly timestamp: number,
        public readonly embedding?: number[],
        public readonly metadata: MemoryMetadata = {
            accessCount: 0,
            lastAccessed: Date.now()
        }
    ) { }

    static create(
        id: string,
        content: string,
        category: MemoryCategory,
        importance: number,
        embedding?: number[],
        metadata?: Partial<MemoryMetadata>
    ): Memory {
        return new Memory(
            id,
            content,
            category,
            importance,
            Date.now(),
            embedding,
            {
                accessCount: 0,
                lastAccessed: Date.now(),
                ...metadata
            }
        );
    }
}