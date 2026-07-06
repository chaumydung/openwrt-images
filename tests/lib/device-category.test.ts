// Guards the featured-grid category grouping: target→category mapping and stable group order.
import { describe, expect, it } from 'vitest'
import { deviceCategory, groupByCategory } from '../../src/lib/device-category'

const dev = (target: string) => ({ builds: [{ target }] }) as Parameters<typeof deviceCategory>[0]

describe('deviceCategory', () => {
  it('maps x86 and armsr targets to x86', () => {
    expect(deviceCategory(dev('x86/64'))).toBe('x86')
    expect(deviceCategory(dev('x86/generic'))).toBe('x86')
    expect(deviceCategory(dev('armsr/armv8'))).toBe('x86')
  })

  it('maps single-board targets to sbc', () => {
    expect(deviceCategory(dev('bcm27xx/bcm2712'))).toBe('sbc')
    expect(deviceCategory(dev('rockchip/armv8'))).toBe('sbc')
    expect(deviceCategory(dev('sunxi/cortexa53'))).toBe('sbc')
  })

  it('defaults everything else to router', () => {
    expect(deviceCategory(dev('mediatek/filogic'))).toBe('router')
    expect(deviceCategory(dev('qualcommax/ipq60xx'))).toBe('router')
    expect(deviceCategory(dev('ath79/nand'))).toBe('router')
  })
})

describe('groupByCategory', () => {
  it('orders groups x86 → sbc → router and drops empty groups', () => {
    const groups = groupByCategory([dev('mediatek/filogic'), dev('x86/64'), dev('rockchip/armv8')])
    expect(groups.map((g) => g.category)).toEqual(['x86', 'sbc', 'router'])
    expect(groupByCategory([dev('ath79/nand')]).map((g) => g.category)).toEqual(['router'])
  })

  it('preserves input order inside a group', () => {
    const a = dev('x86/64')
    const b = dev('x86/generic')
    expect(groupByCategory([a, b])[0].devices).toEqual([a, b])
  })
})
