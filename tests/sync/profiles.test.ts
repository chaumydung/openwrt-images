import { describe, it, expect, vi } from 'vitest'
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

  it('extracts image variants and device packages onto each build', () => {
    const devices = normalizeProfiles(load('tests/fixtures/openwrt-x86-64-profiles.json'), distro, '24.10.1')
    const build = devices.find((x) => x.builds[0].profileId === 'generic')!.builds[0]
    expect(build.devicePackages).toContain('kmod-e1000')
    const image = build.images.find((i) => i.type === 'combined')!
    expect(image.name).toMatch(/combined\.img\.gz$/)
    expect(image.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(image).not.toHaveProperty('size') // only name/type/sha256 are kept
  })

  it('omits devicePackages when the profile has none', () => {
    const raw: RawProfilesJson = {
      version_number: 'v',
      target: 't/s',
      arch_packages: 'x86_64',
      default_packages: [],
      profiles: { p1: { titles: [{ vendor: 'Acme', model: 'R1' }], images: [{ name: 'a.bin', type: 'sysupgrade' }] } },
    }
    const [device] = normalizeProfiles(raw, distro, '1.0')
    expect(device.builds[0].devicePackages).toBeUndefined()
    expect(device.builds[0].images).toEqual([{ name: 'a.bin', type: 'sysupgrade' }])
  })
})

describe('mergeDevices', () => {
  it('merges the same slug from two distros into one device with two builds', () => {
    const a = { slug: 's', vendor: 'V', model: 'M', variant: null, builds: [{ distro: 'openwrt' as const, version: '1', target: 't/s', profileId: 'p', images: [] }] }
    const b = { slug: 's', vendor: 'V', model: 'M', variant: null, builds: [{ distro: 'immortalwrt' as const, version: '2', target: 't/s', profileId: 'p', images: [] }] }
    const merged = mergeDevices([[a], [b]])
    expect(merged).toHaveLength(1)
    expect(merged[0].builds).toHaveLength(2)
  })

  it('warns when distinct devices collide on the same slug', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = { slug: 's', vendor: 'VendorA', model: 'M1', variant: null, builds: [{ distro: 'openwrt' as const, version: '1', target: 't/s', profileId: 'p', images: [] }] }
    const b = { slug: 's', vendor: 'VendorB', model: 'M2', variant: null, builds: [{ distro: 'immortalwrt' as const, version: '2', target: 't/s', profileId: 'q', images: [] }] }
    const merged = mergeDevices([[a], [b]])
    expect(merged).toHaveLength(1)
    expect(merged[0].builds).toHaveLength(2)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
