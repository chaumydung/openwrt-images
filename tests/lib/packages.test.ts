import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  categorize,
  fetchPackageIndex,
  parseApkIndex,
  parsePackageIndex,
  resolveArch,
  UPSTREAM_TIMEOUT_MS,
  UpstreamError,
  UpstreamNotFoundError,
} from '../../src/lib/packages'
import type { PackageEntry } from '../../src/lib/packages'
import { GET } from '../../src/app/api/packages/route'

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const textResponse = (body: string, status = 200) => new Response(body, { status })

const entry = (name: string, section = ''): PackageEntry => ({
  name, version: '1.0', section, sizeBytes: 1, description: '', feed: 'base',
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('parsePackageIndex', () => {
  it('parses multiple records with all fields', () => {
    const text = [
      'Package: luci-app-adblock',
      'Version: git-24.1',
      'Section: luci',
      'Size: 12345',
      'Description: LuCI support for Adblock',
      '',
      'Package: sqm-scripts',
      'Version: 1.6.0-1',
      'Section: net',
      'Size: 54321',
      'Description: SQM scripts',
    ].join('\n')
    expect(parsePackageIndex(text, 'luci')).toEqual([
      { name: 'luci-app-adblock', version: 'git-24.1', section: 'luci', sizeBytes: 12345, description: 'LuCI support for Adblock', feed: 'luci' },
      { name: 'sqm-scripts', version: '1.6.0-1', section: 'net', sizeBytes: 54321, description: 'SQM scripts', feed: 'luci' },
    ])
  })

  it('defaults missing fields and skips blocks without Package', () => {
    const text = 'Architecture: x86_64\n\nPackage: bare-pkg\n'
    expect(parsePackageIndex(text, 'base')).toEqual([
      { name: 'bare-pkg', version: '', section: '', sizeBytes: 0, description: '', feed: 'base' },
    ])
  })

  it('handles CRLF line endings', () => {
    const text = 'Package: crlf-pkg\r\nVersion: 2.0\r\nSize: 7\r\n\r\nPackage: second\r\nSize: not-a-number\r\n'
    const parsed = parsePackageIndex(text, 'target')
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ name: 'crlf-pkg', version: '2.0', sizeBytes: 7 })
    expect(parsed[1]).toMatchObject({ name: 'second', sizeBytes: 0 })
  })
})

describe('parseApkIndex', () => {
  it('parses the 25.12 APK index.json package map, deriving section from the feed', () => {
    // Real shape captured from downloads.openwrt.org/releases/25.12.5/packages/aarch64_cortex-a53/base/index.json
    const text = '{"version":2,"architecture":"aarch64_cortex-a53","packages":{"464xlat":"13","6in4":"29","adb":"5.0.2~6fe92d1a-r4"}}'
    expect(parseApkIndex(text, 'base')).toEqual([
      { name: '464xlat', version: '13', section: 'base', sizeBytes: 0, description: '', feed: 'base' },
      { name: '6in4', version: '29', section: 'base', sizeBytes: 0, description: '', feed: 'base' },
      { name: 'adb', version: '5.0.2~6fe92d1a-r4', section: 'base', sizeBytes: 0, description: '', feed: 'base' },
    ])
  })

  it('returns no entries when the packages map is absent', () => {
    expect(parseApkIndex('{"version":2,"architecture":"x86_64"}', 'luci')).toEqual([])
  })
})

describe('categorize', () => {
  it('groups by name prefix, then by capitalized section, sorted', () => {
    const categories = categorize([
      entry('zlib', 'libs'),
      entry('kmod-fs-ext4', 'kernel'),
      entry('luci-app-sqm', 'luci'),
      entry('luci-theme-bootstrap', 'luci'),
      entry('curl', 'net'),
      entry('luci-app-adblock', 'luci'),
      entry('mystery-pkg'),
    ])
    expect(categories.map((c) => c.name)).toEqual(['Kernel Modules', 'Libs', 'LuCI Apps', 'Net', 'Other', 'Themes'])
    const luciApps = categories.find((c) => c.name === 'LuCI Apps')!
    expect(luciApps.packages.map((p) => p.name)).toEqual(['luci-app-adblock', 'luci-app-sqm'])
    expect(categories.find((c) => c.name === 'Other')!.packages[0].name).toBe('mystery-pkg')
  })
})

describe('resolveArch', () => {
  it('fetches profiles.json with daily revalidate and returns arch_packages', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ arch_packages: 'aarch64_cortex-a53' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(resolveArch('openwrt', '24.10.2', 'mediatek/filogic')).resolves.toBe('aarch64_cortex-a53')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://downloads.openwrt.org/releases/24.10.2/targets/mediatek/filogic/profiles.json',
      { next: { revalidate: 86400 } },
    )
  })

  it('throws UpstreamNotFoundError on 404 and UpstreamError on other failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => textResponse('missing', 404)))
    await expect(resolveArch('openwrt', '24.10.2', 'x86/64')).rejects.toBeInstanceOf(UpstreamNotFoundError)
    vi.stubGlobal('fetch', vi.fn(async () => textResponse('boom', 500)))
    await expect(resolveArch('openwrt', '24.10.2', 'x86/64')).rejects.toBeInstanceOf(UpstreamError)
  })

  it('rejects with UpstreamError when the upstream fetch times out', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const promise = resolveArch('openwrt', '24.10.2', 'x86/64')
    const assertion = expect(promise).rejects.toBeInstanceOf(UpstreamError)
    await vi.advanceTimersByTimeAsync(UPSTREAM_TIMEOUT_MS)
    await assertion
  })
})

function stubIndexFetch(overrides: Record<string, string> = {}) {
  const bodies: Record<string, string> = {
    '/releases/24.10.2/targets/x86/64/packages/Packages':
      'Package: kmod-fs-ext4\nSection: kernel\nSize: 100\n\nPackage: dupe-pkg\nVersion: target-1\nSection: kernel\n',
    '/releases/24.10.2/packages/x86_64/base/Packages':
      'Package: dupe-pkg\nVersion: base-1\nSection: base\n\nPackage: zlib\nSection: libs\nSize: 50\n',
    '/releases/24.10.2/packages/x86_64/packages/Packages': 'Package: curl\nSection: net\nSize: 200\n',
    '/releases/24.10.2/packages/x86_64/luci/Packages': 'Package: luci-app-sqm\nSection: luci\nSize: 30\n',
    ...overrides,
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/profiles.json')) return jsonResponse({ arch_packages: 'x86_64' })
    const match = Object.entries(bodies).find(([suffix]) => url.endsWith(suffix))
    if (!match) throw new Error(`unexpected url: ${url}`)
    return textResponse(match[1])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Stub for the 25.12+ layout: any /Packages URL is 404, only the given index.json bodies exist.
function stubApkFetch(bodies: Record<string, string>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/profiles.json')) return jsonResponse({ arch_packages: 'x86_64' })
    const match = Object.entries(bodies).find(([suffix]) => url.endsWith(suffix))
    return match ? textResponse(match[1]) : textResponse('missing', 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('fetchPackageIndex', () => {
  it('merges target and arch feeds, deduping by name with target priority', async () => {
    stubIndexFetch()
    const packages = await fetchPackageIndex('openwrt', '24.10.2', 'x86/64')
    expect(packages.map((p) => p.name).sort()).toEqual(['curl', 'dupe-pkg', 'kmod-fs-ext4', 'luci-app-sqm', 'zlib'])
    const dupe = packages.find((p) => p.name === 'dupe-pkg')!
    expect(dupe).toMatchObject({ version: 'target-1', feed: 'target' })
    expect(packages.find((p) => p.name === 'curl')!.feed).toBe('packages')
  })

  it('falls back to APK index.json per feed when Packages is 404 (25.12+ layout)', async () => {
    const fetchMock = stubApkFetch({
      '/releases/25.12.5/targets/x86/64/packages/index.json':
        '{"version":2,"architecture":"x86_64","packages":{"kmod-fs-ext4":"6.6.104-r1"}}',
      '/releases/25.12.5/packages/x86_64/base/index.json':
        '{"version":2,"architecture":"x86_64","packages":{"zlib":"1.3.1-r1"}}',
      '/releases/25.12.5/packages/x86_64/packages/index.json':
        '{"version":2,"architecture":"x86_64","packages":{"curl":"8.9.1-r1"}}',
      '/releases/25.12.5/packages/x86_64/luci/index.json':
        '{"version":2,"architecture":"x86_64","packages":{"luci-app-sqm":"12.4"}}',
    })
    const packages = await fetchPackageIndex('openwrt', '25.12.5', 'x86/64')
    expect(packages.map((p) => p.name).sort()).toEqual(['curl', 'kmod-fs-ext4', 'luci-app-sqm', 'zlib'])
    expect(packages.find((p) => p.name === 'zlib')).toMatchObject({ version: '1.3.1-r1', section: 'base', feed: 'base' })
    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls.filter((u) => u.endsWith('/Packages'))).toHaveLength(4)
    expect(urls.filter((u) => u.endsWith('/index.json'))).toHaveLength(4)
  })

  it('rejects with UpstreamNotFoundError when both Packages and index.json are missing', async () => {
    stubApkFetch({})
    await expect(fetchPackageIndex('openwrt', '25.12.5', 'x86/64')).rejects.toBeInstanceOf(UpstreamNotFoundError)
  })
})

const routeUrl = (distro: string, version: string, target: string) =>
  new Request(`http://localhost/api/packages?distro=${distro}&version=${version}&target=${encodeURIComponent(target)}`)

describe('GET /api/packages', () => {
  it('rejects invalid params with 400 before any upstream fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await GET(routeUrl('debian', '24.10.2', 'x86/64'))).status).toBe(400)
    expect((await GET(routeUrl('openwrt', 'evil/../path', 'x86/64'))).status).toBe(400)
    expect((await GET(routeUrl('openwrt', '24.10.2', '../../etc/passwd'))).status).toBe(400)
    expect((await GET(routeUrl('openwrt', '24.10.2', 'x86'))).status).toBe(400)
    expect((await GET(new Request('http://localhost/api/packages'))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns arch, categories, and total with a public cache header', async () => {
    stubIndexFetch()
    const res = await GET(routeUrl('openwrt', '24.10.2', 'x86/64'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600')
    const body = await res.json()
    expect(body.arch).toBe('x86_64')
    expect(body.total).toBe(5)
    expect(body.categories.map((c: { name: string }) => c.name)).toContain('Kernel Modules')
  })

  it('maps upstream 404 to 404 and upstream failure to 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => textResponse('missing', 404)))
    expect((await GET(routeUrl('openwrt', '99.99', 'x86/64'))).status).toBe(404)
    vi.stubGlobal('fetch', vi.fn(async () => textResponse('boom', 503)))
    expect((await GET(routeUrl('openwrt', '24.10.2', 'x86/64'))).status).toBe(502)
  })
})
