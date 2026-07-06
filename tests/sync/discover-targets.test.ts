import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { discoverTargets } from '../../scripts/sync/discover-targets'

afterEach(() => vi.unstubAllGlobals())

const distro = { id: 'openwrt' as const, label: 'OpenWrt', baseUrl: 'https://downloads.openwrt.org' }

describe('discoverTargets', () => {
  it('combines target and subtarget listings into target/subtarget pairs', async () => {
    const targetsHtml = readFileSync('tests/fixtures/openwrt-targets-index.html', 'utf8')
    const subHtml = readFileSync('tests/fixtures/openwrt-x86-subtargets-index.html', 'utf8')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) =>
        String(url).endsWith('/targets/')
          ? new Response(targetsHtml, { status: 200 })
          : new Response(subHtml, { status: 200 }),
      ),
    )
    const pairs = await discoverTargets(distro, '24.10.1')
    expect(pairs.length).toBeGreaterThan(0)
    expect(pairs.every((p) => /^[\w.-]+\/[\w.-]+$/.test(p))).toBe(true)
    expect(pairs.some((p) => p.startsWith('x86/'))).toBe(true)
  })
})
