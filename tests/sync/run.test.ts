import { describe, it, expect } from 'vitest'
import { buildCatalog } from '../../scripts/sync/run'

const distros = [
  { id: 'openwrt' as const, label: 'OpenWrt', baseUrl: 'https://o.example' },
  { id: 'immortalwrt' as const, label: 'ImmortalWrt', baseUrl: 'https://i.example' },
]

const fakeRaw = (target: string) => ({
  version_number: 'v',
  target,
  arch_packages: 'aarch64_cortex-a53',
  default_packages: [],
  profiles: { p1: { titles: [{ vendor: 'Acme', model: 'R1' }], images: [] } },
})

describe('buildCatalog', () => {
  it('walks distros -> version -> targets -> profiles and merges devices', async () => {
    const { devices, meta } = await buildCatalog(distros, {
      discoverStableVersion: async () => '9.9.9',
      discoverTargets: async () => ['t/s'],
      fetchProfiles: async (_d, _v, target) => fakeRaw(target),
    })
    expect(devices).toHaveLength(1) // 两个发行版同一设备合并
    expect(devices[0].builds).toHaveLength(2)
    expect(meta.distros).toHaveLength(2)
    expect(meta.distros[0]).toMatchObject({ version: '9.9.9', targetCount: 1, deviceCount: 1 })
  })

  it('skips targets without profiles.json', async () => {
    const { devices } = await buildCatalog([distros[0]], {
      discoverStableVersion: async () => '9.9.9',
      discoverTargets: async () => ['a/1', 'b/1'],
      fetchProfiles: async (_d, _v, target) => (target === 'a/1' ? fakeRaw(target) : null),
    })
    expect(devices).toHaveLength(1)
  })
})
