// Neon Postgres Db adapter: Drizzle over the Neon HTTP driver (real mode only; reads DATABASE_URL).
import { neon } from '@neondatabase/serverless'
import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { randomUUID } from 'node:crypto'
import { builds, feedback, quota, users } from './schema'
import type { Build, BuildSpec, BuildStatus, BuildUpdate, Db, Feedback, User } from './types'

const ACTIVE_STATUSES: BuildStatus[] = ['queued', 'building']

export function createNeonDb(): Db {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required when APP_MODE=real')
  const db = drizzle(neon(url))

  return {
    users: {
      async upsert(input: { id: string; githubLogin: string }): Promise<User> {
        const [row] = await db
          .insert(users)
          .values(input)
          .onConflictDoUpdate({ target: users.id, set: { githubLogin: input.githubLogin } })
          .returning()
        return row
      },
      async get(id: string): Promise<User | null> {
        const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
        return row ?? null
      },
    },
    builds: {
      async create(input: { userId: string; spec: BuildSpec }): Promise<Build> {
        const [row] = await db
          .insert(builds)
          .values({ id: randomUUID(), userId: input.userId, status: 'queued', spec: input.spec })
          .returning()
        return row
      },
      async get(id: string): Promise<Build | null> {
        const [row] = await db.select().from(builds).where(eq(builds.id, id)).limit(1)
        return row ?? null
      },
      async updateStatus(id: string, patch: BuildUpdate): Promise<Build | null> {
        const [row] = await db
          .update(builds)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(builds.id, id))
          .returning()
        return row ?? null
      },
      async listActiveCount(): Promise<number> {
        const [row] = await db.select({ value: count() }).from(builds).where(inArray(builds.status, ACTIVE_STATUSES))
        return row.value
      },
      async activeByUser(userId: string): Promise<Build[]> {
        return db
          .select()
          .from(builds)
          .where(and(eq(builds.userId, userId), inArray(builds.status, ACTIVE_STATUSES)))
          .orderBy(asc(builds.createdAt))
      },
    },
    quota: {
      async getUsedToday(userId: string, utcDay: string): Promise<number> {
        const [row] = await db
          .select({ used: quota.used })
          .from(quota)
          .where(and(eq(quota.userId, userId), eq(quota.day, utcDay)))
          .limit(1)
        return row?.used ?? 0
      },
      async increment(userId: string, utcDay: string): Promise<number> {
        const [row] = await db
          .insert(quota)
          .values({ userId, day: utcDay, used: 1 })
          .onConflictDoUpdate({
            target: [quota.userId, quota.day],
            set: { used: sql`${quota.used} + 1` },
          })
          .returning({ used: quota.used })
        return row.used
      },
      async decrementIfPositive(userId: string, utcDay: string): Promise<number> {
        const [row] = await db
          .update(quota)
          .set({ used: sql`${quota.used} - 1` })
          .where(and(eq(quota.userId, userId), eq(quota.day, utcDay), gt(quota.used, 0)))
          .returning({ used: quota.used })
        // No row updated → the counter is already 0 (or was never created).
        return row?.used ?? 0
      },
    },
    feedback: {
      async create(input: { name: string; email: string; message: string }): Promise<Feedback> {
        const [row] = await db.insert(feedback).values(input).returning()
        return row
      },
    },
  }
}
