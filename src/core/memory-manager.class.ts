import { v4 as uuidv4 } from 'uuid';
import Fuse from 'fuse.js';

import { Logger } from '../services/logger.service';

import {
    MemoryEntry,
    MemoryCategory,
    MemoryBuffer,
    MemoryOperationResult,
    MemorySearchParams,
    MemoryMetadata
} from '../types/memory.interface';
import { StorageService } from '../services/storage.service';

export class MemoryManager {
    private workingMemory: MemoryBuffer;
    private coreMemory: MemoryBuffer;
    private archivalMemory: MemoryEntry[];
    private storageService: StorageService;

    constructor(
        workingMemorySize: number = 10,
        coreMemorySize: number = 5,
        storagePath?: string
    ) {
        this.storageService = new StorageService(storagePath);
        this.loadPersistedMemories();
        // Initialize memory buffers
        this.workingMemory = {
            maxSize: workingMemorySize,
            currentSize: 0,
            entries: []
        };

        this.coreMemory = {
            maxSize: coreMemorySize,
            currentSize: 0,
            entries: []
        };

        this.archivalMemory = [];
    }

    private async loadPersistedMemories(): Promise<void> {
        const memories = await this.storageService.loadMemories();
        if (memories) {
            this.workingMemory = memories.working;
            this.coreMemory = memories.core;
            this.archivalMemory = memories.archival;
        }
    }

    private async persistMemories(): Promise<void> {
        await this.storageService.saveMemories(
            this.workingMemory,
            this.coreMemory,
            this.archivalMemory
        );
    }

    public async insertMemory(
        content: string,
        category: MemoryCategory,
        importance: number = 0.5,
        metadata: Partial<MemoryMetadata> = {}
    ): Promise<MemoryOperationResult> {
        try {
            const entry: MemoryEntry = {
                id: uuidv4(),
                content,
                timestamp: Date.now(),
                importance,
                category,
                metadata: {
                    lastAccessed: Date.now(),
                    accessCount: 0,
                    ...metadata
                }
            };

            Logger.memory('Inserting', { category, content: content.substring(0, 50) + '...', importance });

            let result: MemoryOperationResult;
            switch (category) {
                case MemoryCategory.WORKING:
                    result = this.insertWorkingMemory(entry);
                    break;
                case MemoryCategory.CORE:
                    result = this.insertCoreMemory(entry);
                    break;
                case MemoryCategory.ARCHIVAL:
                    result = this.insertArchivalMemory(entry);
                    break;
                default:
                    throw new Error('Invalid memory category');
            }

            await this.persistMemories();
            Logger.memoryState(this);
            return result;
        } catch (error) {
            Logger.error(error as Error);
            return {
                success: false,
                message: `Failed to insert memory: ${(error as Error).message}`
            };
        }
    }

    private insertWorkingMemory(entry: MemoryEntry): MemoryOperationResult {
        if (this.workingMemory.currentSize >= this.workingMemory.maxSize) {
            const leastImportant = this.findLeastImportantMemory(this.workingMemory.entries);
            Logger.memory('Moving to Archival', {
                from: 'working',
                memory: leastImportant.content.substring(0, 50) + '...'
            });

            this.archivalMemory.push(leastImportant);
            this.workingMemory.entries = this.workingMemory.entries
                .filter(m => m.id !== leastImportant.id);
            this.workingMemory.currentSize--;
        }

        this.workingMemory.entries.push(entry);
        this.workingMemory.currentSize++;

        return {
            success: true,
            message: 'Memory inserted into working memory',
            data: entry
        };
    }
    private insertCoreMemory(entry: MemoryEntry): MemoryOperationResult {
        if (this.coreMemory.currentSize >= this.coreMemory.maxSize) {
            // Only replace if new memory is more important
            const leastImportant = this.findLeastImportantMemory(this.coreMemory.entries);
            if (entry.importance > leastImportant.importance) {
                this.archivalMemory.push(leastImportant);
                this.coreMemory.entries = this.coreMemory.entries
                    .filter(m => m.id !== leastImportant.id);
                this.coreMemory.entries.push(entry);
                return {
                    success: true,
                    message: 'Memory inserted into core memory, replaced least important entry',
                    data: entry
                };
            }
            return {
                success: false,
                message: 'Core memory full and new memory not important enough'
            };
        }

        this.coreMemory.entries.push(entry);
        this.coreMemory.currentSize++;
        return {
            success: true,
            message: 'Memory inserted into core memory',
            data: entry
        };
    }

    private insertArchivalMemory(entry: MemoryEntry): MemoryOperationResult {
        this.archivalMemory.push(entry);
        return {
            success: true,
            message: 'Memory inserted into archival memory',
            data: entry
        };
    }

    public async searchMemory(params: MemorySearchParams): Promise<MemoryOperationResult> {
        try {
            const { query, category, limit = 5, minImportance = 0 } = params;
            let searchSpace: MemoryEntry[] = [];

            // Determine which memory stores to search
            if (category) {
                switch (category) {
                    case MemoryCategory.WORKING:
                        searchSpace = this.workingMemory.entries;
                        break;
                    case MemoryCategory.CORE:
                        searchSpace = this.coreMemory.entries;
                        break;
                    case MemoryCategory.ARCHIVAL:
                        searchSpace = this.archivalMemory;
                        break;
                }
            } else {
                searchSpace = [
                    ...this.workingMemory.entries,
                    ...this.coreMemory.entries,
                    ...this.archivalMemory
                ];
            }

            // Filter by importance first
            searchSpace = searchSpace.filter(entry => entry.importance >= minImportance);

            // Configure Fuse options
            const fuseOptions = {
                keys: ['content'],
                includeScore: true,
                threshold: 0.4,
                minMatchCharLength: 3
            };

            const fuse = new Fuse(searchSpace, fuseOptions);
            const searchResults = fuse.search(query);

            // Combine fuzzy search score with importance
            const results = searchResults
                .map(result => ({
                    ...result.item,
                    relevance: (1 - (result.score || 0)) * result.item.importance
                }))
                .sort((a, b) => b.relevance - a.relevance)
                .slice(0, limit);

            return {
                success: true,
                message: `Found ${results.length} matching memories`,
                data: results
            };
        } catch (error) {
            Logger.error(error as Error);
            return {
                success: false,
                message: `Search failed: ${(error as Error).message}`
            };
        }
    }

    private findLeastImportantMemory(memories: MemoryEntry[]): MemoryEntry {
        return memories.reduce((min, current) =>
            current.importance < min.importance ? current : min
        );
    }
}