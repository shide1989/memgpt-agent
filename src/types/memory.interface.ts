/**
 * Represents a memory entry in the system
 */
export interface MemoryEntry {
    id: string;
    content: string;
    timestamp: number;
    importance: number; // 0-1 score for memory priority
    category: MemoryCategory;
    metadata: MemoryMetadata;
}

/**
 * Categories of memory as described in the MemGPT paper
 */
export enum MemoryCategory {
    CORE = 'core',      // Essential personality traits, core knowledge
    WORKING = 'working', // Current context and short-term memory
    ARCHIVAL = 'archival' // Long-term storage
}

/**
 * Additional metadata for memory entries
 */
export interface MemoryMetadata {
    lastAccessed?: number;
    accessCount: number;
    associations?: string[]; // Related memory IDs
    embedding?: number[]; // Vector embedding for similarity search
}

/**
 * Memory buffer with fixed size
 */
export interface MemoryBuffer {
    maxSize: number;
    currentSize: number;
    entries: MemoryEntry[];
}

/**
 * Memory operation results
 */
export interface MemoryOperationResult {
    success: boolean;
    message: string;
    data?: any;
}

/**
 * Memory search parameters
 */
export interface MemorySearchParams {
    query: string;
    category?: MemoryCategory;
    limit?: number;
    minImportance?: number;
}