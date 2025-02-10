import { db } from '../client';
import { memories } from '../schema/memory.schema';
import { eq, sql } from 'drizzle-orm';
import { MemoryEntity, MemoryCategory } from '../../../../domain/memory/entities/memory.entity';
import { MemoryRepository } from '../../../../domain/memory/repositories/memory.repository';
import { Logger } from '../../../logging/logger.service';

export class PostgresMemoryRepository implements MemoryRepository {
    async insert(memory: MemoryEntity): Promise<void> {
        try {
            await db.insert(memories).values({
                id: memory.id,
                content: memory.content,
                category: memory.category,
                importance: memory.importance,
                embedding: memory.embedding,
                timestamp: new Date(memory.timestamp),
                metadata: memory.metadata
            });
        } catch (error) {
            Logger.error('Failed to insert memory:', error as Error);
            throw error;
        }
    }

    async findById(id: string): Promise<MemoryEntity | null> {
        try {
            const result = await db.query.memories.findFirst({
                where: eq(memories.id, id)
            });
            return result ? this.mapToMemory(result) : null;
        } catch (error) {
            Logger.error('Failed to find memory by ID:', error as Error);
            throw error;
        }
    }

    async findByCategory(category: MemoryCategory): Promise<MemoryEntity[]> {
        try {
            const results = await db.query.memories.findMany({
                where: eq(memories.category, category)
            });
            return results.map(this.mapToMemory);
        } catch (error) {
            Logger.error('Failed to find memories by category:', error as Error);
            throw error;
        }
    }

    async semanticSearch(embedding: number[], limit: number = 5, category: MemoryCategory | undefined = undefined): Promise<MemoryEntity[]> {
        try {
            const results = await db.query.memories.findMany({
                orderBy: sql`embedding <-> ${JSON.stringify(embedding)}::vector`,
                limit,
                where: category ? eq(memories.category, category) : undefined
            });
            return results.map(this.mapToMemory);
        } catch (error) {
            Logger.error('Failed to perform semantic search:', error as Error);
            throw error;
        }
    }

    async updateAccessCount(id: string): Promise<void> {
        try {
            await db.update(memories)
                .set({
                    accessCount: sql`access_count + 1`,
                    lastAccessed: new Date()
                })
                .where(eq(memories.id, id));
        } catch (error) {
            Logger.error('Failed to update access count:', error as Error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await db.delete(memories)
                .where(eq(memories.id, id));
        } catch (error) {
            Logger.error('Failed to delete memory:', error as Error);
            throw error;
        }
    }

    private mapToMemory(dbMemory: any): MemoryEntity {
        return new MemoryEntity(
            dbMemory.id,
            dbMemory.content,
            dbMemory.category as MemoryCategory,
            dbMemory.importance,
            dbMemory.timestamp.getTime(),
            dbMemory.embedding,
            dbMemory.metadata
        );
    }
}