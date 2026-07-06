// Behavioral tests for the in-memory Db adapter (full repository interface) and the getDb factory.
import { describe, expect, it } from 'vitest'
import { getDb } from '@/lib/db'
import { createMemoryDb } from '@/lib/db/memory'
import type { BuildSpec } from '@/lib/db/types'

const spec: BuildSpec = {
  distro: 'openwrt',
  version: '24.10.0',
  target: 'ramips/mt7621',
  profile: 'xiaomi_mi-router-4a-gigabit',
  packages: ['luci', '-ppp'],
  config: { hostname: 'OpenWrt', lanIp: '192.168.1.1' },
}

describe('memory adapter: users', () => {
  it('upsert creates a user and get returns it', async () => {
    const db = createMemoryDb()
    const user = await db.users.upsert({ id: '42', githubLogin: 'alice' })
    expect(user).toMatchObject({ id: '42', githubLogin: 'alice' })
    expect(user.createdAt).toBeInstanceOf(Date)
    expect(await db.users.get('42')).toEqual(user)
  })

  it('upsert updates githubLogin but keeps createdAt', async () => {
    const db = createMemoryDb()
    const first = await db.users.upsert({ id: '42', githubLogin: 'alice' })
    const second = await db.users.upsert({ id: '42', githubLogin: 'alice-renamed' })
    expect(second.githubLogin).toBe('alice-renamed')
    expect(second.createdAt).toEqual(first.createdAt)
  })

  it('get returns null for unknown id', async () => {
    expect(await createMemoryDb().users.get('missing')).toBeNull()
  })
})

describe('memory adapter: builds', () => {
  it('create returns a queued build with defaults and spec roundtrip', async () => {
    const db = createMemoryDb()
    const build = await db.builds.create({ userId: '42', spec })
    expect(build.id).toMatch(/[0-9a-f-]{36}/)
    expect(build).toMatchObject({
      userId: '42',
      status: 'queued',
      spec,
      externalId: null,
      queuePosition: null,
      logUrl: null,
      artifactUrl: null,
      artifactExpiresAt: null,
      failureReason: null,
      quotaRefunded: false,
    })
    expect(await db.builds.get(build.id)).toEqual(build)
  })

  it('get returns null for unknown id', async () => {
    expect(await createMemoryDb().builds.get('missing')).toBeNull()
  })

  it('updateStatus patches fields, bumps updatedAt, returns null for unknown id', async () => {
    const db = createMemoryDb()
    const build = await db.builds.create({ userId: '42', spec })
    const updated = await db.builds.updateStatus(build.id, {
      status: 'success',
      externalId: 'run-7',
      artifactUrl: 'https://r2.example/fw.img.gz',
      artifactExpiresAt: new Date('2026-07-13T00:00:00Z'),
    })
    expect(updated).toMatchObject({ status: 'success', externalId: 'run-7' })
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(build.updatedAt.getTime())
    expect(await db.builds.updateStatus('missing', { status: 'failed' })).toBeNull()
  })

  it('listActiveCount counts only queued and building', async () => {
    const db = createMemoryDb()
    const a = await db.builds.create({ userId: '1', spec })
    await db.builds.create({ userId: '2', spec })
    const c = await db.builds.create({ userId: '3', spec })
    await db.builds.updateStatus(a.id, { status: 'building' })
    await db.builds.updateStatus(c.id, { status: 'failed' })
    expect(await db.builds.listActiveCount()).toBe(2)
  })

  it('activeByUser returns only that user’s active builds, oldest first', async () => {
    const db = createMemoryDb()
    const a = await db.builds.create({ userId: '42', spec })
    const b = await db.builds.create({ userId: '42', spec })
    await db.builds.create({ userId: 'other', spec })
    const done = await db.builds.create({ userId: '42', spec })
    await db.builds.updateStatus(done.id, { status: 'timeout' })
    const active = await db.builds.activeByUser('42')
    expect(active.map((x) => x.id)).toEqual([a.id, b.id])
  })

  it('returned objects are copies — mutating them does not affect the store', async () => {
    const db = createMemoryDb()
    const build = await db.builds.create({ userId: '42', spec })
    build.spec.packages.push('mutated')
    const fresh = await db.builds.get(build.id)
    expect(fresh!.spec.packages).toEqual(spec.packages)
  })
})

describe('memory adapter: quota', () => {
  it('getUsedToday defaults to 0, increment counts up, decrementIfPositive floors at 0', async () => {
    const db = createMemoryDb()
    expect(await db.quota.getUsedToday('42', '2026-07-06')).toBe(0)
    expect(await db.quota.increment('42', '2026-07-06')).toBe(1)
    expect(await db.quota.increment('42', '2026-07-06')).toBe(2)
    expect(await db.quota.decrementIfPositive('42', '2026-07-06')).toBe(1)
    expect(await db.quota.decrementIfPositive('42', '2026-07-06')).toBe(0)
    expect(await db.quota.decrementIfPositive('42', '2026-07-06')).toBe(0)
  })

  it('quota is scoped per user and per day', async () => {
    const db = createMemoryDb()
    await db.quota.increment('42', '2026-07-06')
    expect(await db.quota.getUsedToday('42', '2026-07-07')).toBe(0)
    expect(await db.quota.getUsedToday('other', '2026-07-06')).toBe(0)
  })
})

describe('memory adapter: feedback', () => {
  it('create assigns incrementing ids and stores the entry', async () => {
    const db = createMemoryDb()
    const first = await db.feedback.create({ name: 'Bob', email: 'bob@example.com', message: 'Great tool' })
    const second = await db.feedback.create({ name: 'Eve', email: 'eve@example.com', message: 'More devices please' })
    expect(first).toMatchObject({ id: 1, name: 'Bob', email: 'bob@example.com', message: 'Great tool' })
    expect(second.id).toBe(2)
    expect(second.createdAt).toBeInstanceOf(Date)
  })
})

describe('getDb factory', () => {
  it('returns the same in-memory singleton in mock mode', async () => {
    expect(process.env.APP_MODE).not.toBe('real')
    const db = getDb()
    expect(getDb()).toBe(db)
    await db.users.upsert({ id: 'singleton', githubLogin: 'x' })
    expect(await getDb().users.get('singleton')).not.toBeNull()
  })
})
