import { describe, it, expect } from 'vitest'
import { searchDevices } from '../../src/lib/catalog'
import type { CatalogDevice } from '../../src/lib/catalog'

const dev = (slug: string, vendor: string, model: string): CatalogDevice => ({
  slug, vendor, model, variant: null,
  builds: [{ distro: 'openwrt', version: '1', target: 't/s', profileId: 'p', images: [] }],
})

const devices = [dev('gl-inet-gl-mt3000', 'GL.iNet', 'GL-MT3000'), dev('tp-link-archer-c7-v5', 'TP-Link', 'Archer C7')]

describe('searchDevices', () => {
  it('matches case-insensitively across vendor and model', () => {
    expect(searchDevices(devices, 'mt3000')).toHaveLength(1)
    expect(searchDevices(devices, 'TP-LINK')).toHaveLength(1)
    expect(searchDevices(devices, 'archer c7')).toHaveLength(1)
  })
  it('returns empty for blank query and respects limit', () => {
    expect(searchDevices(devices, '  ')).toHaveLength(0)
    expect(searchDevices([...devices, ...devices], 'a', 1)).toHaveLength(1)
  })
})
