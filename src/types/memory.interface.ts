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
    embedding?: number[] | null;  // Store embedding vector
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
    minSimilarity?: number;  // Replace minImportance
}

interface SummarizationStrategy {
    // Trigger summarization when buffer reaches threshold
    workingMemoryThreshold: number;    // e.g., 80% full
    timeWindow: number;                // e.g., last 24 hours
    importanceThreshold: number;       // e.g., > 0.7
}
