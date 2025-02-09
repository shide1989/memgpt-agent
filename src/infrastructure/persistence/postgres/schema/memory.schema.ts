import {
    pgTable,
    uuid,
    text,
    timestamp,
    real,
    integer,
    json,
    pgEnum
} from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import { MemoryCategory } from '../../../../domain/memory/entities/memory.entity';

// Create an enum for memory categories
export const memoryCategoryEnum = pgEnum('memory_category', [
    MemoryCategory.CORE,
    MemoryCategory.WORKING,
    MemoryCategory.ARCHIVAL
]);

// Define metadata type for better type safety
export type MemoryMetadataDB = {
    lastAccessed?: number;
    accessCount: number;
    consolidatedFrom?: string[];
    associations?: string[];
    archivedAt?: number;
};

export const memories = pgTable('memories', {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    category: memoryCategoryEnum('category').notNull(),
    importance: real('importance').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    accessCount: integer('access_count').notNull().default(0),
    lastAccessed: timestamp('last_accessed'),
    metadata: json('metadata').$type<MemoryMetadataDB>()
});

// Type inference helpers
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
