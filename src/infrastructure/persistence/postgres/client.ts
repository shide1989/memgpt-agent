import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/memory.schema';

export const db = drizzle(process.env.DATABASE_URL!, { schema });