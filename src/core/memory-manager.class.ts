import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

import { Logger } from '../services/logger.service';
import { MemoryStore } from '../services/memory-store.service';
import {
    MemoryBuffer,
    MemoryCategory,
    MemoryEntry,
    MemoryMetadata,
    MemoryOperationResult,
    MemorySearchParams
} from '../types/memory.interface';

interface SummarizationConfig {
    capacityThreshold: number;     // 0-1 percentage
    minMemoriesForSummary: number; // Minimum memories before summarizing
    targetReduction: number;       // How many memories to remove after summarization
}

export class MemoryManager {
    private summarizationConfig: SummarizationConfig;
    private workingMemory: MemoryBuffer;
    private coreMemory: MemoryBuffer;
    private archivalMemory: MemoryEntry[];
    private openai: OpenAI;
    private memoryStore: MemoryStore;

    constructor(
        workingMemorySize: number = 10,
        coreMemorySize: number = 5,
        storagePath?: string,
        apiKey?: string
    ) {
        this.openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
        this.memoryStore = new MemoryStore();

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

        this.summarizationConfig = {
            capacityThreshold: 0.8,
            minMemoriesForSummary: 5,
            targetReduction: 3
        };
    }

    async loadMemoriesFromDB(): Promise<void> {
        try {
            // Load and map working memories
            const workingMemories = await this.memoryStore.getByCategory(MemoryCategory.WORKING);
            this.workingMemory.entries = workingMemories.map(m => ({
                ...m,
                timestamp: m.timestamp.getTime(),
                category: m.category as MemoryCategory,
                metadata: m.metadata as any
            }));
            this.workingMemory.currentSize = workingMemories.length;

            // Apply same mapping for core and archival
            const coreMemories = await this.memoryStore.getByCategory(MemoryCategory.CORE);
            this.coreMemory.entries = coreMemories.map(m => ({
                ...m,
                timestamp: m.timestamp.getTime(),
                category: m.category as MemoryCategory,
                metadata: m.metadata as any
            }));
            this.coreMemory.currentSize = coreMemories.length;

            const archivalMemories = await this.memoryStore.getByCategory(MemoryCategory.ARCHIVAL);
            this.archivalMemory = archivalMemories.map(m => ({
                ...m,
                timestamp: m.timestamp.getTime(),
                category: m.category as MemoryCategory,
                metadata: m.metadata as any
            }));
        } catch (error) {
            Logger.error('Failed to load memories from database:');
            throw error;
        }
    }

    private async getEmbedding(text: string): Promise<number[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: text.slice(0, 8191)  // OpenAI's token limit
            });

            Logger.memory('Generated embedding', {
                textLength: text.length,
                embeddingSize: response.data[0].embedding.length
            });

            return response.data[0].embedding;
        } catch (error) {
            Logger.error('Failed to generate embedding:');
            Logger.error(error as Error);
            throw new Error(`Embedding generation failed: ${(error as Error).message}`);
        }
    }

    public async insertMemory(
        content: string,
        category: MemoryCategory,
        importance: number = 0.5,
        metadata: Partial<MemoryMetadata> = {}
    ): Promise<MemoryOperationResult> {
        try {
            // Generate embedding for the content
            const embedding = await this.getEmbedding(content);

            const entry: MemoryEntry = {
                id: uuidv4(),
                content,
                timestamp: Date.now(),
                importance,
                category,
                embedding,
                metadata: {
                    lastAccessed: Date.now(),
                    accessCount: 0,
                    ...metadata
                }
            };

            Logger.memory('Inserting with embedding', {
                category,
                content: content.substring(0, 50) + '...',
                embeddingSize: embedding.length
            });

            let result: MemoryOperationResult;
            switch (category) {
                case MemoryCategory.WORKING:
                    result = await this.insertWorkingMemory(entry);
                    // Check capacity after inserting to working memory
                    await this.checkWorkingMemoryCapacity();
                    break;
                case MemoryCategory.CORE:
                    result = await this.insertCoreMemory(entry);
                    break;
                case MemoryCategory.ARCHIVAL:
                    result = await this.insertArchivalMemory(entry);
                    break;
                default:
                    throw new Error('Invalid memory category');
            }

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

    private async insertWorkingMemory(entry: MemoryEntry): Promise<MemoryOperationResult> {
        if (this.workingMemory.currentSize >= this.workingMemory.maxSize) {
            const leastImportant = this.findLeastImportantMemory(this.workingMemory.entries);

            // Move to archival
            await this.memoryStore.insert({
                ...leastImportant,
                category: MemoryCategory.ARCHIVAL,
                metadata: {
                    ...leastImportant.metadata,
                    archivedAt: Date.now()
                }
            });

            // Remove from working memory
            this.workingMemory.entries = this.workingMemory.entries
                .filter(m => m.id !== leastImportant.id);
            this.workingMemory.currentSize--;
        }

        // Insert into database and working memory
        await this.memoryStore.insert(entry);
        this.workingMemory.entries.push(entry);
        this.workingMemory.currentSize++;

        return {
            success: true,
            message: 'Memory inserted into working memory',
            data: entry
        };
    }

    private async insertCoreMemory(entry: MemoryEntry): Promise<MemoryOperationResult> {
        if (this.coreMemory.currentSize >= this.coreMemory.maxSize) {
            const leastImportant = this.findLeastImportantMemory(this.coreMemory.entries);
            if (entry.importance > leastImportant.importance) {
                // Move to archival
                await this.memoryStore.insert({
                    ...leastImportant,
                    category: MemoryCategory.ARCHIVAL,
                    metadata: {
                        ...leastImportant.metadata,
                        archivedAt: Date.now()
                    }
                });

                // Remove from core memory
                this.coreMemory.entries = this.coreMemory.entries
                    .filter(m => m.id !== leastImportant.id);

                // Insert new entry
                await this.memoryStore.insert(entry);
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

        // Insert into database and core memory
        await this.memoryStore.insert(entry);
        this.coreMemory.entries.push(entry);
        this.coreMemory.currentSize++;

        return {
            success: true,
            message: 'Memory inserted into core memory',
            data: entry
        };
    }

    private async insertArchivalMemory(entry: MemoryEntry): Promise<MemoryOperationResult> {
        await this.memoryStore.insert(entry);
        this.archivalMemory.push(entry);
        return {
            success: true,
            message: 'Memory inserted into archival memory',
            data: entry
        };
    }

    public async searchMemory(params: MemorySearchParams): Promise<MemoryOperationResult> {
        try {
            const { query, category, limit = 5 } = params;
            let searchSpace: MemoryEntry[] = [
                ...this.workingMemory.entries,
                ...this.coreMemory.entries,
                ...this.archivalMemory
            ];

            // Generate embedding for the search query
            const queryEmbedding = await this.getEmbedding(query);

            // Use MemoryStore for semantic search
            let results = await this.memoryStore.semanticSearch(queryEmbedding, limit);

            // Determine which memory stores to search
            if (category) {
                searchSpace = this.getMemoriesByCategory(category);
            }

            // Update access counts for found memories
            for (const memory of results) {
                await this.memoryStore.updateAccessCount(memory.id);
            }

            Logger.memory('Semantic search completed', {
                query,
                resultsCount: results.length
            });

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

    public async cleanupMemories(threshold: number = 30): Promise<MemoryOperationResult> {
        try {
            const now = Date.now();
            const dayInMs = 24 * 60 * 60 * 1000;
            const originalCount = this.archivalMemory.length;

            Logger.memory('Starting cleanup', { threshold: `${threshold} days`, originalCount });

            this.archivalMemory = this.archivalMemory.filter(memory => {
                const keepMemory = memory.importance > 0.7 ||
                    (now - memory.timestamp) < (threshold * dayInMs);

                if (!keepMemory) {
                    Logger.memory('Removing memory', {
                        content: memory.content.substring(0, 50),
                        age: Math.floor((now - memory.timestamp) / dayInMs)
                    });
                }
                return keepMemory;
            });

            const removedCount = originalCount - this.archivalMemory.length;

            return {
                success: true,
                message: `Cleaned up ${removedCount} memories`,
                data: { removedCount, remainingCount: this.archivalMemory.length }
            };
        } catch (error) {
            Logger.error(error as Error);
            return {
                success: false,
                message: `Cleanup failed: ${(error as Error).message}`
            };
        }
    }

    public async summarizeMemories(
        category: MemoryCategory,
        options: { detailed?: boolean; timeframe?: string } = {}
    ): Promise<MemoryOperationResult> {
        try {
            const memories = this.getMemoriesByCategory(category);
            Logger.memory('Summarizing memories', { category, count: memories.length });

            if (memories.length === 0) {
                return {
                    success: true,
                    message: 'No memories to summarize',
                    data: ''
                };
            }

            // Sort by timestamp and importance
            const sortedMemories = memories
                .sort((a, b) => b.importance - a.importance)
                .map(m => ({
                    content: m.content,
                    timestamp: new Date(m.timestamp).toISOString(),
                    importance: m.importance
                }));

            const prompt = this.createSummarizationPrompt(sortedMemories, options);

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{
                    role: 'system',
                    content: prompt
                }],
                temperature: 0.7,
                max_tokens: 500
            });

            const summary = completion.choices[0].message.content;

            Logger.memory('Summarization completed', {
                category,
                memoryCount: memories.length,
                summaryLength: summary?.length
            });

            return {
                success: true,
                message: `Summarized ${memories.length} memories`,
                data: summary
            };
        } catch (error) {
            Logger.error(error as Error);
            return {
                success: false,
                message: `Summarization failed: ${(error as Error).message}`
            };
        }
    }

    private createSummarizationPrompt(
        memories: Array<{ content: string; timestamp: string; importance: number }>,
        options: { detailed?: boolean; timeframe?: string }
    ): string {
        const memoryText = memories
            .map(m => `[${m.timestamp}] (Importance: ${m.importance}) ${m.content}`)
            .join('\n');

        return `Summarize the following memories${options.timeframe ? ` from ${options.timeframe}` : ''}. 
${options.detailed ? 'Provide a detailed summary with key points and patterns.' : 'Provide a concise summary of the main points.'}

Focus on:
1. Most important information (based on importance scores)
2. Key patterns and themes
3. Critical insights
4. Temporal relationships between memories

Memories to summarize:
${memoryText}

${options.detailed ? 'Provide a detailed analysis and summary.' : 'Provide a brief, focused summary.'}`;
    }

    private getMemoriesByCategory(category: MemoryCategory): MemoryEntry[] {
        switch (category) {
            case MemoryCategory.WORKING:
                return this.workingMemory.entries;
            case MemoryCategory.CORE:
                return this.coreMemory.entries;
            case MemoryCategory.ARCHIVAL:
                return this.archivalMemory;
            default:
                return [];
        }
    }

    private async checkWorkingMemoryCapacity(): Promise<void> {
        const currentCapacity = this.workingMemory.currentSize / this.workingMemory.maxSize;

        if (currentCapacity >= this.summarizationConfig.capacityThreshold &&
            this.workingMemory.currentSize >= this.summarizationConfig.minMemoriesForSummary) {

            Logger.memory('Working memory capacity threshold reached', {
                capacity: `${(currentCapacity * 100).toFixed(1)}%`,
                memoryCount: this.workingMemory.currentSize
            });

            await this.consolidateWorkingMemory();
        }
    }

    private async consolidateWorkingMemory(): Promise<void> {
        try {
            // Get summary of working memory
            const summaryResult = await this.summarizeMemories(MemoryCategory.WORKING, {
                detailed: true,
                timeframe: 'recent'
            });

            if (!summaryResult.success || !summaryResult.data) {
                throw new Error('Failed to create summary');
            }

            // Create a new consolidated memory in core memory
            await this.insertMemory(
                summaryResult.data,
                MemoryCategory.CORE,
                0.8, // High importance for consolidated memories
                {
                    consolidatedFrom: this.workingMemory.entries
                        .slice(0, this.summarizationConfig.targetReduction)
                        .map(m => m.id)
                }
            );

            // Move summarized memories to archival
            const memoriesToArchive = this.workingMemory.entries
                .slice(0, this.summarizationConfig.targetReduction);

            for (const memory of memoriesToArchive) {
                await this.insertMemory(
                    memory.content,
                    MemoryCategory.ARCHIVAL,
                    memory.importance,
                    { ...memory.metadata, archivedAt: Date.now() }
                );
            }

            // Remove summarized memories from working memory
            this.workingMemory.entries = this.workingMemory.entries
                .slice(this.summarizationConfig.targetReduction);
            this.workingMemory.currentSize -= this.summarizationConfig.targetReduction;

            Logger.memory('Working memory consolidated', {
                memoriesArchived: this.summarizationConfig.targetReduction,
                newWorkingMemorySize: this.workingMemory.currentSize
            });

        } catch (error) {
            Logger.error(`Failed to consolidate working memory: ${(error as Error).message}`);
        }
    }
}