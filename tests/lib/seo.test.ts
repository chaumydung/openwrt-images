// Guards SEO config integrity: featured slugs must exist in the catalog, waves must resolve, siteUrl must fall back.
import { describe, it, expect, afterEach } from 'vitest'
import { getFeaturedSlugs, getSitemapDeviceSlugs, siteUrl } from '../../src/lib/seo'
import { getCatalog } from '../../src/lib/catalog'

describe('featured devices', () => {
  it('every featured slug exists in the catalog', () => {
    const catalogSlugs = new Set(getCatalog().devices.map((d) => d.slug))
    const missing = getFeaturedSlugs().filter((slug) => !catalogSlugs.has(slug))
    expect(missing).toEqual([])
  })

  it('holds 30-50 unique slugs (launch wave size, PRD 4.3)', () => {
    const featured = getFeaturedSlugs()
    expect(featured.length).toBeGreaterThanOrEqual(30)
    expect(featured.length).toBeLessThanOrEqual(50)
    expect(new Set(featured).size).toBe(featured.length)
  })
})

describe('getSitemapDeviceSlugs', () => {
  it('resolves the wave-1 "featured" reference to the featured list', () => {
    expect(getSitemapDeviceSlugs()).toEqual(getFeaturedSlugs())
  })
})

describe('siteUrl', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = original
  })

  it('falls back to localhost when NEXT_PUBLIC_SITE_URL is unset', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(siteUrl()).toBe('http://localhost:3000')
  })

  it('uses NEXT_PUBLIC_SITE_URL when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    expect(siteUrl()).toBe('https://example.com')
  })
})
