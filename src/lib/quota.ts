// Daily build-quota business rules (PRD §2): free users get 1 custom build per UTC day.
import { getDb } from './db'

export const FREE_DAILY_LIMIT = 1

/** Returns the current UTC day as 'YYYY-MM-DD'. */
export function currentUtcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns the next UTC midnight (when the daily quota resets). */
export function quotaResetAt(): Date {
  const reset = new Date()
  reset.setUTCHours(24, 0, 0, 0)
  return reset
}

export type QuotaResult =
  | { allowed: true; day: string }
  | { allowed: false; day: string; resetAt: Date }

/**
 * Consumes one unit of today's quota (UTC day). Increment-then-check keeps the
 * check atomic under concurrent requests: an over-limit increment is rolled back.
 */
export async function checkAndConsume(userId: string): Promise<QuotaResult> {
  const day = currentUtcDay()
  const used = await getDb().quota.increment(userId, day)
  if (used > FREE_DAILY_LIMIT) {
    await getDb().quota.decrementIfPositive(userId, day)
    return { allowed: false, day, resetAt: quotaResetAt() }
  }
  return { allowed: true, day }
}

/**
 * Refunds one unit for a systemic build failure (executor error / timeout).
 * Never goes below zero; per-build idempotency is the caller's job via the
 * builds.quotaRefunded flag (refund once per build only).
 */
export async function refund(userId: string, day: string): Promise<void> {
  await getDb().quota.decrementIfPositive(userId, day)
}
