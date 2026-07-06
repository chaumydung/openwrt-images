import { describe, it, expect } from 'vitest'
import { buildSpecs, type TohJson } from '../../scripts/sync/toh'

// Small inline ToH table mirroring the real toh.json column/row layout.
const toh: TohJson = {
  columns: ['deviceid', 'brand', 'model', 'version', 'cpu', 'cpucores', 'cpumhz', 'rammb', 'flashmb', 'ethernet1gports', 'wlanhardware', 'switch'],
  entries: [
    ['glinet:gl-mt3000', 'GL.iNet', 'GL-MT3000', null, 'MediaTek MT7981B', '2', '1300', '512', '256', '2', ['MediaTek MT7981B', 'MediaTek MT7976CN'], '-'],
    ['tplink:archer-c7-v2', 'TP-Link', 'Archer C7', 'v2', 'Qualcomm Atheros QCA9558', '1', '720', '128', '16', '5', '¿', 'QCA8337'],
    ['tplink:archer-c7-v5', 'TP-Link', 'Archer C7', 'v5', 'Qualcomm Atheros QCA9563', '1', '775', '128', '16', '5', '¿', 'QCA8337'],
    ['netgear:r7800', 'NETGEAR', 'R7800', 'v1', 'Qualcomm IPQ8065', '2', '1700', '512', '128', '5', '¿', '-'],
    ['acme:empty', 'Acme', 'NoSpecs', null, '¿', '¿', '¿', '-', '-', '-', '-', '-'],
  ],
}

const device = (slug: string, vendor: string, model: string, variant: string | null = null) => ({ slug, vendor, model, variant })

describe('buildSpecs', () => {
  it('matches by normalized brand+model, joins multi-value cells, drops unknown markers', () => {
    const specs = buildSpecs([device('gl-inet-gl-mt3000', 'GL.iNet', 'GL-MT3000')], toh)
    expect(specs['gl-inet-gl-mt3000']).toEqual({
      cpu: 'MediaTek MT7981B',
      cpuCores: '2',
      cpuMhz: '1300',
      ramMb: '512',
      flashMb: '256',
      ethernet1gPorts: '2',
      wlanHardware: 'MediaTek MT7981B, MediaTek MT7976CN',
    })
  })

  it('matches a variant device to the ToH row with the same version', () => {
    const specs = buildSpecs([device('tp-link-archer-c7-v5', 'TP-Link', 'Archer C7', 'v5')], toh)
    expect(specs['tp-link-archer-c7-v5']).toMatchObject({ cpuMhz: '775' })
  })

  it('refuses ambiguous matches: variantless device with conflicting per-version specs gets nothing', () => {
    const specs = buildSpecs([device('tp-link-archer-c7', 'TP-Link', 'Archer C7')], toh)
    expect(specs).toEqual({})
  })

  it('lets a variant device fall back to brand+model only when specs are unambiguous', () => {
    const specs = buildSpecs([device('netgear-r7800-v2', 'NETGEAR', 'R7800', 'v2')], toh)
    expect(specs['netgear-r7800-v2']).toMatchObject({ cpu: 'Qualcomm IPQ8065' })
  })

  it('omits devices with no ToH row or with only unknown values', () => {
    const specs = buildSpecs([device('acme-nospecs', 'Acme', 'NoSpecs'), device('foo-bar', 'Foo', 'Bar')], toh)
    expect(specs).toEqual({})
  })
})
