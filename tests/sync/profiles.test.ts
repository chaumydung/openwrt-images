import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { slugify, normalizeProfiles, mergeDevices, type RawProfilesJson } from '../../scripts/sync/profiles'

const distro = { id: 'openwrt' as const, label: 'OpenWrt', baseUrl: 'https://downloads.openwrt.org' }
const load = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as RawProfilesJson

describe('slugify', () => {
  it('kebab-cases vendor/model/variant and strips unsafe chars', () => {
    expect(slugify('GL.iNet', 'GL-MT3000')).toBe('gl-inet-gl-mt3000')
    expect(slugify('TP-Link', 'Archer C7', 'v5')).toBe('tp-link-archer-c7-v5')
  })
})

describe('normalizeProfiles', () => {
  it('turns a real filogic profiles.json into devices with vendor/model and build refs', () => {
    const devices = normalizeProfiles(load('tests/fixtures/openwrt-mediatek-filogic-profiles.json'), distro, '24.10.1')
    expect(devices.length).toBeGreaterThan(10)
    const d = devices.find((x) => x.slug.includes('gl-mt3000'))
    expect(d).toBeDefined()
    expect(d!.builds[0]).toMatchObject({ distro: 'openwrt', version: '24.10.1', target: 'mediatek/filogic' })
  })
})

describe('mergeDevices', () => {
  it('merges the same slug from two distros into one device with two builds', () => {
    const a = { slug: 's', vendor: 'V', model: 'M', variant: null, builds: [{ distro: 'openwrt' as const, version: '1', target: 't/s', profileId: 'p' }] }
    const b = { slug: 's', vendor: 'V', model: 'M', variant: null, builds: [{ distro: 'immortalwrt' as const, version: '2', target: 't/s', profileId: 'p' }] }
    const merged = mergeDevices([[a], [b]])
    expect(merged).toHaveLength(1)
    expect(merged[0].builds).toHaveLength(2)
  })
})
