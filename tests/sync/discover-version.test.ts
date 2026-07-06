import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseIndexHrefs, pickLatestStable, discoverStableVersion } from '../../scripts/sync/discover-version'
import type { DistroConfig } from '../../scripts/sync/types'

const distro: DistroConfig = { id: 'openwrt', label: 'OpenWrt', baseUrl: 'https://downloads.openwrt.org' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseIndexHrefs', () => {
  it('extracts directory names from a real autoindex page', () => {
    const html = readFileSync('tests/fixtures/openwrt-releases-index.html', 'utf8')
    const hrefs = parseIndexHrefs(html)
    expect(hrefs.length).toBeGreaterThan(5)
    expect(hrefs.some((h) => /^\d+\.\d+\.\d+$/.test(h))).toBe(true)
  })
})

describe('pickLatestStable', () => {
  it('picks highest semver and ignores rc/snapshot/non-version dirs', () => {
    const dirs = ['17.01.7', '23.05.5', '24.10.0', '24.10.0-rc7', '24.10.1', 'faillogs', 'packages-24.10']
    expect(pickLatestStable(dirs)).toBe('24.10.1')
  })

  it('returns null when nothing matches', () => {
    expect(pickLatestStable(['foo', 'bar-rc1'])).toBeNull()
  })

  it('resolves the expected version end-to-end from the real releases index fixture', () => {
    const html = readFileSync('tests/fixtures/openwrt-releases-index.html', 'utf8')
    expect(pickLatestStable(parseIndexHrefs(html))).toBe('25.12.5')
  })
})

describe('discoverStableVersion', () => {
  it('resolves stable_version from .versions.json on success', async () => {
    const mock = vi.fn(async () => new Response(JSON.stringify({ stable_version: '24.10.1' }), { status: 200 }))
    vi.stubGlobal('fetch', mock)

    await expect(discoverStableVersion(distro)).resolves.toBe('24.10.1')
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the releases/ index when .versions.json 404s', async () => {
    const html = readFileSync('tests/fixtures/openwrt-releases-index.html', 'utf8')
    const expected = pickLatestStable(parseIndexHrefs(html))
    const mock = vi.fn(async (url: string) => {
      if (url.endsWith('.versions.json')) return new Response('not found', { status: 404 })
      return new Response(html, { status: 200 })
    })
    vi.stubGlobal('fetch', mock)

    await expect(discoverStableVersion(distro)).resolves.toBe(expected)
    expect(mock).toHaveBeenCalledTimes(2)
    expect(mock.mock.calls[1][0]).toMatch(/\/releases\/$/)
  })

  it('rejects (does not swallow) when fetch persistently returns 500', async () => {
    vi.useFakeTimers()
    try {
      const mock = vi.fn(async () => new Response('server error', { status: 500 }))
      vi.stubGlobal('fetch', mock)

      const promise = discoverStableVersion(distro)
      const expectation = expect(promise).rejects.toThrow('HTTP 500')
      await vi.runAllTimersAsync()
      await expectation
    } finally {
      vi.useRealTimers()
    }
  })
})
