// Quota business rules: daily consume/deny, UTC day boundary (fake timers), and refund semantics.
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/lib/db'
import { checkAndConsume, currentUtcDay, FREE_DAILY_LIMIT, refund } from '@/lib/quota'

// Each test uses a fresh userId: the process-wide memory adapter keys quota by (userId, day).
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-06T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('checkAndConsume', () => {
  it('allows the first build of the day and records usage', async () => {
    const userId = randomUUID()
    const result = await checkAndConsume(userId)
    expect(result).toEqual({ allowed: true, day: '2026-07-06' })
    expect(await getDb().quota.getUsedToday(userId, '2026-07-06')).toBe(1)
  })

  it('denies once the daily limit is reached and reports the UTC reset time', async () => {
    const userId = randomUUID()
    for (let i = 0; i < FREE_DAILY_LIMIT; i++) {
      expect((await checkAndConsume(userId)).allowed).toBe(true)
    }
    const denied = await checkAndConsume(userId)
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) {
      expect(denied.resetAt.toISOString()).toBe('2026-07-07T00:00:00.000Z')
    }
    // A denied attempt must not burn quota (the over-limit increment is rolled back).
    expect(await getDb().quota.getUsedToday(userId, '2026-07-06')).toBe(FREE_DAILY_LIMIT)
  })

  it('resets at the UTC day boundary', async () => {
    const userId = randomUUID()
    vi.setSystemTime(new Date('2026-07-06T23:59:59Z'))
    expect((await checkAndConsume(userId)).allowed).toBe(true)
    expect((await checkAndConsume(userId)).allowed).toBe(false)

    vi.setSystemTime(new Date('2026-07-07T00:00:01Z'))
    const nextDay = await checkAndConsume(userId)
    expect(nextDay).toEqual({ allowed: true, day: '2026-07-07' })
  })
})

describe('refund', () => {
  it('returns the day’s quota so the user can build again', async () => {
    const userId = randomUUID()
    const consumed = await checkAndConsume(userId)
    expect(consumed.allowed).toBe(true)
    await refund(userId, consumed.day)
    expect((await checkAndConsume(userId)).allowed).toBe(true)
  })

  it('never drives usage below zero when called repeatedly', async () => {
    const userId = randomUUID()
    const day = currentUtcDay()
    await refund(userId, day)
    await refund(userId, day)
    expect(await getDb().quota.getUsedToday(userId, day)).toBe(0)
    // Still exactly FREE_DAILY_LIMIT builds available — double refund granted nothing extra.
    for (let i = 0; i < FREE_DAILY_LIMIT; i++) {
      expect((await checkAndConsume(userId)).allowed).toBe(true)
    }
    expect((await checkAndConsume(userId)).allowed).toBe(false)
  })
})
