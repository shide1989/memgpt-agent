import { pgTable, uuid, text, timestamp, real, integer, json } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';

export const memories = pgTable('memories', {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    category: text('category').notNull(),
    importance: real('importance').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    accessCount: integer('access_count').notNull().default(0),
    lastAccessed: timestamp('last_accessed'),
    metadata: json('metadata')
});

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;