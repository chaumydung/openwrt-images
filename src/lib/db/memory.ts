// In-memory Db adapter (Maps) with the same semantics as the Neon implementation; used in mock mode and tests.
import { randomUUID } from 'node:crypto'
import type { Build, BuildSpec, BuildUpdate, Db, Feedback, User } from './types'

const ACTIVE_STATUSES = ['queued', 'building']

export function createMemoryDb(): Db {
  const users = new Map<string, User>()
  const builds = new Map<string, Build>()
  const quota = new Map<string, number>() // key: `${userId}|${utcDay}`
  const feedback: Feedback[] = []

  return {
    users: {
      async upsert(input: { id: string; githubLogin: string }): Promise<User> {
        const existing = users.get(input.id)
        const user: User = {
          id: input.id,
          githubLogin: input.githubLogin,
          createdAt: existing?.createdAt ?? new Date(),
        }
        users.set(user.id, user)
        return structuredClone(user)
      },
      async get(id: string): Promise<User | null> {
        const user = users.get(id)
        return user ? structuredClone(user) : null
      },
    },
    builds: {
      async create(input: { userId: string; spec: BuildSpec }): Promise<Build> {
        const now = new Date()
        const build: Build = {
          id: randomUUID(),
          userId: input.userId,
          status: 'queued',
          spec: structuredClone(input.spec),
          externalId: null,
          queuePosition: null,
          logUrl: null,
          artifactUrl: null,
          artifactExpiresAt: null,
          failureReason: null,
          quotaRefunded: false,
          createdAt: now,
          updatedAt: now,
        }
        builds.set(build.id, build)
        return structuredClone(build)
      },
      async get(id: string): Promise<Build | null> {
        const build = builds.get(id)
        return build ? structuredClone(build) : null
      },
      async getByExternalId(externalId: string): Promise<Build | null> {
        const build = [...builds.values()].find((b) => b.externalId === externalId)
        return build ? structuredClone(build) : null
      },
      async updateStatus(id: string, patch: BuildUpdate): Promise<Build | null> {
        const build = builds.get(id)
        if (!build) return null
        const updated: Build = { ...build, ...patch, updatedAt: new Date() }
        builds.set(id, updated)
        return structuredClone(updated)
      },
      async listActiveCount(): Promise<number> {
        return [...builds.values()].filter((b) => ACTIVE_STATUSES.includes(b.status)).length
      },
      async activeByUser(userId: string): Promise<Build[]> {
        return [...builds.values()]
          .filter((b) => b.userId === userId && ACTIVE_STATUSES.includes(b.status))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((b) => structuredClone(b))
      },
    },
    quota: {
      async getUsedToday(userId: string, utcDay: string): Promise<number> {
        return quota.get(`${userId}|${utcDay}`) ?? 0
      },
      async increment(userId: string, utcDay: string): Promise<number> {
        const key = `${userId}|${utcDay}`
        const used = (quota.get(key) ?? 0) + 1
        quota.set(key, used)
        return used
      },
      async decrementIfPositive(userId: string, utcDay: string): Promise<number> {
        const key = `${userId}|${utcDay}`
        const used = Math.max(0, (quota.get(key) ?? 0) - 1)
        quota.set(key, used)
        return used
      },
    },
    feedback: {
      async create(input: { name: string; email: string; message: string }): Promise<Feedback> {
        const entry: Feedback = { id: feedback.length + 1, ...input, createdAt: new Date() }
        feedback.push(entry)
        return structuredClone(entry)
      },
    },
  }
}
