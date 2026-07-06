// Tests for the prebuilt consumption layer: fixture reads in mock mode, unknown-slug/distro
// null, and real-mode latest.json URL construction with 404 degradation.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getPrebuiltImages } from '../../src/lib/prebuilt'

describe('getPrebuiltImages (mock mode)', () => {
  it('reads the local fixture and composes variant download URLs', async () => {
    const data = await getPrebuiltImages('gl-inet-gl-mt3000', 'openwrt')
    expect(data).not.toBeNull()
    expect(data!.buildDate).toBe('2026-07-06')
    expect(data!.version).toBe('25.12.5')
    expect(data!.variants.length).toBeGreaterThan(0)
    const sysupgrade = data!.variants.find((v) => v.type === 'sysupgrade')!
    expect(sysupgrade.file).toBe('07.06-GLINET_GL-MT3000-SQUASHFS-SYSUPGRADE.BIN')
    expect(sysupgrade.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(sysupgrade.sizeBytes).toBeGreaterThan(0)
    expect(sysupgrade.hintKey).toBe('sysupgrade')
    expect(sysupgrade.url).toBe(
      'https://prebuilt.mock.invalid/prebuilt/gl-inet-gl-mt3000/openwrt/2026-07-06/07.06-GLINET_GL-MT3000-SQUASHFS-SYSUPGRADE.BIN',
    )
  })

  it('returns null for a slug without a fixture', async () => {
    expect(await getPrebuiltImages('tp-link-archer-c7-v5', 'openwrt')).toBeNull()
  })

  it('returns null when the fixture is for a different distro', async () => {
    expect(await getPrebuiltImages('gl-inet-gl-mt3000', 'immortalwrt')).toBeNull()
  })
})

describe('getPrebuiltImages (real mode)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('APP_MODE', 'real')
    vi.stubEnv('R2_PUBLIC_BASE_URL', 'https://dl.example.com')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('fetches latest.json from the conventional R2 path and composes URLs', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          slug: 'generic-x86-64',
          distro: 'openwrt',
          version: '25.12.5',
          buildDate: '2026-07-07',
          variants: [
            {
              file: '07.07-GENERIC-SQUASHFS-COMBINED-EFI.IMG.GZ',
              type: 'combined-efi',
              sha256: 'ab'.repeat(32),
              sizeBytes: 29360128,
              hintKey: 'combined-efi',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    const data = await getPrebuiltImages('generic-x86-64', 'openwrt')
    expect(fetchMock.mock.calls[0][0]).toBe('https://dl.example.com/prebuilt/generic-x86-64/openwrt/latest.json')
    expect(fetchMock.mock.calls[0][1]).toEqual({ next: { revalidate: 3600 } })
    expect(data).toEqual({
      version: '25.12.5',
      buildDate: '2026-07-07',
      variants: [
        {
          file: '07.07-GENERIC-SQUASHFS-COMBINED-EFI.IMG.GZ',
          type: 'combined-efi',
          sha256: 'ab'.repeat(32),
          sizeBytes: 29360128,
          hintKey: 'combined-efi',
          url: 'https://dl.example.com/prebuilt/generic-x86-64/openwrt/2026-07-07/07.07-GENERIC-SQUASHFS-COMBINED-EFI.IMG.GZ',
        },
      ],
    })
  })

  it('returns null on 404 (no prebuilt run for this device × distro yet)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }))
    expect(await getPrebuiltImages('generic-x86-64', 'immortalwrt')).toBeNull()
  })

  it('falls back to fixtures when R2_PUBLIC_BASE_URL is unset even in real mode', async () => {
    vi.stubEnv('R2_PUBLIC_BASE_URL', '')
    const data = await getPrebuiltImages('gl-inet-gl-mt3000', 'openwrt')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(data!.variants.length).toBeGreaterThan(0)
  })
})
