import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { normalize, searchDevices } from '../../src/lib/search'
import type { CatalogDevice } from '../../src/lib/catalog'

const devices: CatalogDevice[] = JSON.parse(
  readFileSync(path.join(process.cwd(), 'data/catalog/devices.json'), 'utf8'),
)

describe('searchDevices (real catalog data)', () => {
  it('ranks GL.iNet GL-MT3000 first for "mt3000"', () => {
    const results = searchDevices(devices, 'mt3000')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].slug).toBe('gl-inet-gl-mt3000')
  })

  it('matches GL-MT3000 regardless of separators and vendor spelling', () => {
    for (const query of ['gl mt3000', 'gl-mt3000', 'GL.iNet MT3000', 'glmt3000']) {
      const results = searchDevices(devices, query)
      expect(results.some((d) => d.slug === 'gl-inet-gl-mt3000'), query).toBe(true)
    }
  })

  it('matches out-of-order tokens: "ax3000t xiaomi"', () => {
    const results = searchDevices(devices, 'ax3000t xiaomi')
    expect(results.some((d) => d.slug === 'xiaomi-mi-router-ax3000t')).toBe(true)
  })

  it('keeps "archer c7" scoped to the Archer C7 family', () => {
    const results = searchDevices(devices, 'archer c7')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((d) => d.model === 'Archer C7')).toBe(true)
  })

  it('returns multiple results within the limit for "3000"', () => {
    const results = searchDevices(devices, '3000')
    expect(results.length).toBeGreaterThan(1)
    expect(results.length).toBeLessThanOrEqual(20)
    expect(searchDevices(devices, '3000', 5)).toHaveLength(5)
  })

  it('returns empty for blank queries', () => {
    expect(searchDevices(devices, '')).toEqual([])
    expect(searchDevices(devices, '   ')).toEqual([])
  })

  it('orders equally scored "archer" results deterministically by vendor+model', () => {
    const results = searchDevices(devices, 'archer')
    const keys = results.map((d) => normalize(`${d.vendor} ${d.model} ${d.variant ?? ''}`))
    expect(keys).toEqual([...keys].sort())
    expect(searchDevices(devices, 'archer').map((d) => d.slug)).toEqual(results.map((d) => d.slug))
  })
})
