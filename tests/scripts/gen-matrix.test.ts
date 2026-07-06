// Tests for the prebuilt matrix generator: device × distro expansion, skipping combos without
// a build, and a stable entry shape for the workflow's strategy.matrix.
import { describe, it, expect, vi } from 'vitest'
import { genMatrix } from '../../scripts/prebuilt/gen-matrix'
import type { PrebuiltConfig } from '../../scripts/prebuilt/gen-matrix'
import type { CatalogDevice } from '../../src/lib/catalog-types'

const config: PrebuiltConfig = {
  devices: 'featured',
  distros: [
    { id: 'openwrt', defaultPackages: ['luci', 'luci-ssl'] },
    { id: 'immortalwrt', defaultPackages: ['luci', 'luci-ssl'] },
  ],
  retentionRuns: 3,
}

const device = (slug: string, builds: Partial<CatalogDevice['builds'][number]>[]): CatalogDevice => ({
  slug,
  vendor: 'Acme',
  model: slug,
  variant: null,
  builds: builds.map((b) => ({
    distro: 'openwrt',
    version: '25.12.5',
    target: 'x86/64',
    profileId: 'generic',
    images: [],
    ...b,
  })),
})

describe('genMatrix', () => {
  it('emits one entry per featured device × distro with a build, in stable shape', () => {
    const devices = [
      device('both-distros', [
        { distro: 'openwrt', version: '25.12.5', target: 'mediatek/filogic', profileId: 'acme_r1' },
        { distro: 'immortalwrt', version: '25.12.1', target: 'mediatek/filogic', profileId: 'acme_r1' },
      ]),
      device('openwrt-only', [{ distro: 'openwrt' }]),
    ]
    const entries = genMatrix(config, devices, ['both-distros', 'openwrt-only'])
    expect(entries).toEqual([
      {
        slug: 'both-distros',
        distro: 'openwrt',
        version: '25.12.5',
        target: 'mediatek/filogic',
        profile: 'acme_r1',
        packages: 'luci luci-ssl',
      },
      {
        slug: 'both-distros',
        distro: 'immortalwrt',
        version: '25.12.1',
        target: 'mediatek/filogic',
        profile: 'acme_r1',
        packages: 'luci luci-ssl',
      },
      {
        slug: 'openwrt-only',
        distro: 'openwrt',
        version: '25.12.5',
        target: 'x86/64',
        profile: 'generic',
        packages: 'luci luci-ssl',
      },
    ])
  })

  it('skips combos where the device has no build for that distro', () => {
    const entries = genMatrix(config, [device('openwrt-only', [{ distro: 'openwrt' }])], ['openwrt-only'])
    expect(entries).toHaveLength(1)
    expect(entries[0].distro).toBe('openwrt')
  })

  it('warns and skips featured slugs missing from the catalog', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const entries = genMatrix(config, [device('known', [{ distro: 'openwrt' }])], ['ghost', 'known'])
    expect(entries).toHaveLength(1)
    expect(entries[0].slug).toBe('known')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ghost'))
    warn.mockRestore()
  })

  it('honors an explicit slug list instead of the featured reference', () => {
    const devices = [device('a', [{ distro: 'openwrt' }]), device('b', [{ distro: 'openwrt' }])]
    const entries = genMatrix({ ...config, devices: ['b'] }, devices, ['a'])
    expect(entries.map((e) => e.slug)).toEqual(['b'])
  })
})
