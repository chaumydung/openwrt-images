// Database entry point — CONTRACT: business code must import the database ONLY from
// '@/lib/db' (this file) or the quota rules in '@/lib/quota'. Never import drizzle,
// './schema', './neon', or './memory' directly outside src/lib/db/.
import { createMemoryDb } from './memory'
import { createNeonDb } from './neon'
import type { Db } from './types'

export type * from './types'

let instance: Db | null = null

/** Returns the process-wide Db adapter: in-memory when APP_MODE=mock (default), Neon Postgres when APP_MODE=real. */
export function getDb(): Db {
  if (!instance) {
    instance = process.env.APP_MODE === 'real' ? createNeonDb() : createMemoryDb()
  }
  return instance
}
