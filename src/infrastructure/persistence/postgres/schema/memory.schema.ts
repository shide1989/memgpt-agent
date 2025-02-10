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
import { MemoryCategory, MemoryMetadata } from '../entities/memory.entity';

// Create an enum for memory categories
export const memoryCategoryEnum = pgEnum('memory_category', [
    MemoryCategory.CORE,
    MemoryCategory.WORKING,
    MemoryCategory.ARCHIVAL
]);

export const memoriesTable = pgTable('memories', {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    category: memoryCategoryEnum('category').notNull(),
    importance: real('importance').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    accessCount: integer('access_count').notNull().default(0),
    lastAccessed: timestamp('last_accessed'),
    metadata: json('metadata').$type<MemoryMetadata>()
});

// Type inference helpers
export type Memory = typeof memoriesTable.$inferSelect;
export type NewMemory = typeof memoriesTable.$inferInsert;
