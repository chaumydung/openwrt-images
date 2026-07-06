import { describe, it, expect } from 'vitest'
import { mapLimit } from '../../scripts/sync/map-limit'

describe('mapLimit', () => {
  it('preserves order and never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return n * 10
    })
    expect(out).toEqual([10, 20, 30, 40, 50, 60])
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('throws RangeError on non-positive limit', async () => {
    await expect(mapLimit([1], 0, async (n) => n)).rejects.toThrow(RangeError)
    await expect(mapLimit([1], -1, async (n) => n)).rejects.toThrow(RangeError)
  })
})
