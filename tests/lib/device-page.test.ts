// Guards the /device/[slug] page helpers: TDH strings, variant hint copy, upstream URLs, sibling queries.
import { describe, it, expect } from 'vitest'
import { getCatalog } from '../../src/lib/catalog'
import {
  descriptionDistros,
  deviceDescription,
  deviceName,
  deviceTitle,
  imageTypeHint,
  sameTargetDevices,
  sameVendorDevices,
  specRows,
  titleDistro,
  upstreamImageUrl,
  upstreamTargetUrl,
} from '../../src/lib/device-page'

const { devices } = getCatalog()
const mt3000 = devices.find((d) => d.slug === 'gl-inet-gl-mt3000')!

describe('imageTypeHint', () => {
  it('maps the common variant types to PRD 5 guidance copy', () => {
    expect(imageTypeHint('sysupgrade')).toBe('Not sure? Pick this if upgrading from OpenWrt.')
    expect(imageTypeHint('nand-sysupgrade')).toBe('Not sure? Pick this if upgrading from OpenWrt.')
    expect(imageTypeHint('factory')).toBe('For first-time flash from stock firmware.')
    expect(imageTypeHint('web-ui-factory')).toBe('For first-time flash from stock firmware.')
    expect(imageTypeHint('kernel')).toBe('Minimal kernel image, useful for first install or recovery.')
    expect(imageTypeHint('rootfs')).toBe('Rootfs archive for Docker / LXC containers.')
    expect(imageTypeHint('combined-efi')).toBe('Make sure your device supports EFI boot.')
    expect(imageTypeHint('combined')).toBe('Full disk image. Not sure which one? Pick this.')
    expect(imageTypeHint('tftp-recovery')).toContain('Recovery')
    expect(imageTypeHint('sdcard')).toContain('SD card')
  })

  it('returns null for niche types that get no hint', () => {
    expect(imageTypeHint('preloader.bin')).toBeNull()
    expect(imageTypeHint('bl31-uboot.fip')).toBeNull()
  })
})

describe('upstream URLs', () => {
  const owrt = { distro: 'openwrt' as const, version: '25.12.5', target: 'mediatek/filogic' }
  const iwrt = { distro: 'immortalwrt' as const, version: '25.12.1', target: 'x86/64' }

  it('builds openwrt image URLs', () => {
    expect(upstreamImageUrl(owrt, 'openwrt-25.12.5-mediatek-filogic-glinet_gl-mt3000-squashfs-sysupgrade.bin')).toBe(
      'https://downloads.openwrt.org/releases/25.12.5/targets/mediatek/filogic/openwrt-25.12.5-mediatek-filogic-glinet_gl-mt3000-squashfs-sysupgrade.bin',
    )
  })

  it('builds immortalwrt target URLs', () => {
    expect(upstreamTargetUrl(iwrt)).toBe('https://downloads.immortalwrt.org/releases/25.12.1/targets/x86/64/')
  })
})

describe('TDH helpers', () => {
  it('renders the docs/SEO.md title template within 60 characters', () => {
    const title = deviceTitle(deviceName(mt3000), titleDistro(mt3000.builds))
    expect(title).toBe('GL.iNet GL-MT3000 OpenWrt Firmware — Download & Custom Build')
    expect(title.length).toBeLessThanOrEqual(60)
  })

  it('drops the title suffix for long device names, keeping the core keyword', () => {
    const rpi = devices.find((d) => d.slug === 'raspberry-pi-3a-3b-3b-cm3-zero2-zero2w-64bit')!
    const title = deviceTitle(deviceName(rpi), titleDistro(rpi.builds))
    // The device name itself is 48 chars, so even the shortest form exceeds 60 —
    // the degradation floor is `{name} OpenWrt Firmware` (keyword intact, no marketing suffix).
    expect(title).toBe(`${deviceName(rpi)} OpenWrt Firmware`)
    expect(title).not.toContain('Download')
  })

  it('description includes target and version at 150-160 characters for the spot-check device', () => {
    const build = mt3000.builds[0]
    const desc = deviceDescription(deviceName(mt3000), descriptionDistros(mt3000.builds), build.target, build.version)
    expect(desc).toContain('mediatek/filogic')
    expect(desc).toContain(build.version)
    expect(desc.length).toBeGreaterThanOrEqual(150)
    expect(desc.length).toBeLessThanOrEqual(160)
  })

  it('leads with ImmortalWrt only when no OpenWrt build exists', () => {
    expect(titleDistro([{ distro: 'immortalwrt' }])).toBe('ImmortalWrt')
    expect(titleDistro([{ distro: 'openwrt' }, { distro: 'immortalwrt' }])).toBe('OpenWrt')
    expect(descriptionDistros([{ distro: 'openwrt' }, { distro: 'immortalwrt' }])).toBe('OpenWrt/ImmortalWrt')
  })
})

describe('sibling queries', () => {
  it('same-vendor: excludes self, caps at the limit, sorts deterministically', () => {
    const siblings = sameVendorDevices(devices, mt3000)
    expect(siblings.length).toBe(8)
    expect(siblings.every((d) => d.vendor === 'GL.iNet')).toBe(true)
    expect(siblings.some((d) => d.slug === mt3000.slug)).toBe(false)
    const slugs = siblings.map((d) => d.slug)
    expect(slugs).toEqual([...slugs].sort())
    expect(sameVendorDevices(devices, mt3000)).toEqual(siblings) // deterministic across calls
  })

  it('same-target: shares a target, excludes self and same-vendor devices, caps at the limit', () => {
    const siblings = sameTargetDevices(devices, mt3000)
    expect(siblings.length).toBeLessThanOrEqual(8)
    expect(siblings.length).toBeGreaterThan(0)
    expect(siblings.every((d) => d.builds.some((b) => b.target === 'mediatek/filogic'))).toBe(true)
    expect(siblings.some((d) => d.slug === mt3000.slug)).toBe(false)
    expect(siblings.some((d) => d.vendor === mt3000.vendor)).toBe(false)
    const slugs = siblings.map((d) => d.slug)
    expect(slugs).toEqual([...slugs].sort())
  })

  it('respects a custom limit', () => {
    expect(sameVendorDevices(devices, mt3000, 3).length).toBe(3)
  })
})

describe('specRows', () => {
  it('renders only fields with values, with units, from real specs data', () => {
    const rows = specRows({ cpu: 'MediaTek MT7628AN', ramMb: '64', flashMb: '8', ethernet100mPorts: '1' })
    expect(rows).toEqual([
      { label: 'CPU', value: 'MediaTek MT7628AN' },
      { label: 'RAM', value: '64 MB' },
      { label: 'Flash', value: '8 MB' },
      { label: '100 Mbit Ethernet ports', value: '1' },
    ])
  })

  it('skips the unit for non-numeric ToH values (e.g. flash "microSDHC")', () => {
    expect(specRows({ flashMb: 'microSDHC' })).toEqual([{ label: 'Flash', value: 'microSDHC' }])
  })

  it('returns no rows for empty specs', () => {
    expect(specRows({})).toEqual([])
  })
})
