import { db } from '../db/client';
import { memories } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { MemoryEntry, MemoryCategory } from '../types/memory.interface';

export class MemoryStore {
    async insert(memory: MemoryEntry) {
        return await db.insert(memories).values({
            id: memory.id,
            content: memory.content,
            category: memory.category,
            importance: memory.importance,
            embedding: memory.embedding,
        });
    }

    async semanticSearch(embedding: number[], limit: number = 5) {
        return await db.query.memories.findMany({
            orderBy: sql`embedding <-> ${JSON.stringify(embedding)}::vector`,
            limit
        });
    }

    async getByCategory(category: MemoryCategory) {
        return await db.query.memories.findMany({
            where: eq(memories.category, category)
        });
    }

    async updateAccessCount(id: string) {
        return await db.update(memories)
            .set({
                accessCount: sql`access_count + 1`,
                lastAccessed: new Date()
            })
            .where(eq(memories.id, id));
    }
}