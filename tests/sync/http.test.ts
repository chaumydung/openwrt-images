import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchText, HttpNotFoundError } from '../../scripts/sync/http'

afterEach(() => vi.unstubAllGlobals())

describe('fetchText', () => {
  it('returns body on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('hello', { status: 200 })))
    expect(await fetchText('https://example.com/x')).toBe('hello')
  })

  it('throws HttpNotFoundError on 404 without retrying', async () => {
    const mock = vi.fn(async () => new Response('nope', { status: 404 }))
    vi.stubGlobal('fetch', mock)
    await expect(fetchText('https://example.com/x')).rejects.toBeInstanceOf(HttpNotFoundError)
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('retries on 500 then succeeds', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response('err', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', mock)
    expect(await fetchText('https://example.com/x', { retryDelayMs: 1 })).toBe('ok')
    expect(mock).toHaveBeenCalledTimes(2)
  })
})
