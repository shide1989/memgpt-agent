import { MemoryEntity } from "../../../domain/memory/entities/memory.entity";

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
    consolidatedFrom?: string[];  // Add this line
    associations?: string[];
    archivedAt?: number
}

/**
 * Memory buffer with fixed size
 */
export interface MemoryBuffer {
    maxSize: number;
    currentSize: number;
    entries: MemoryEntity[];
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
    minSimilarity?: number;  // Replace minImportance
}
