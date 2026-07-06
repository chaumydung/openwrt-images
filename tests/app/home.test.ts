// Guards the homepage SEO contract: /api/search behavior, FAQ/JSON-LD consistency, copy word count and keyword density.
import { describe, it, expect } from 'vitest'
import { GET } from '../../src/app/api/search/route'
import {
  buildHomeJsonLd,
  FAQ,
  FAQ_HEADING,
  HERO_TITLE,
  META_DESCRIPTION,
  SECTIONS,
} from '../../src/app/home-content'

function search(q: string): Response {
  return GET(new Request(`http://localhost:3000/api/search?q=${encodeURIComponent(q)}`))
}

describe('GET /api/search', () => {
  it('returns at most 12 results shaped {slug, vendor, model, variant, distros[]}', async () => {
    const res = search('archer')
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body.length).toBeLessThanOrEqual(12)
    for (const item of body) {
      expect(Object.keys(item).sort()).toEqual(['distros', 'model', 'slug', 'variant', 'vendor'])
      expect(typeof item.slug).toBe('string')
      expect(item.distros.length).toBeGreaterThan(0)
      for (const distro of item.distros) {
        expect(['openwrt', 'immortalwrt']).toContain(distro)
      }
    }
  })

  it('ranks the exact model match first', async () => {
    const body = await search('gl-mt3000').json()
    expect(body[0].slug).toBe('gl-inet-gl-mt3000')
  })

  it('returns an empty array for empty or whitespace-only q, and when q is missing', async () => {
    expect(await search('').json()).toEqual([])
    expect(await search('   ').json()).toEqual([])
    expect(await GET(new Request('http://localhost:3000/api/search')).json()).toEqual([])
  })

  it('sets a one-hour public cache header', () => {
    expect(search('archer').headers.get('Cache-Control')).toBe('public, max-age=3600')
    expect(search('').headers.get('Cache-Control')).toBe('public, max-age=3600')
  })
})

describe('homepage JSON-LD', () => {
  const jsonLd = buildHomeJsonLd('https://example.com')
  const byType = (type: string) => jsonLd.find((node) => node['@type'] === type)

  it('contains SoftwareApplication, FAQPage, and Organization nodes', () => {
    expect(jsonLd.map((node) => node['@type']).sort()).toEqual(['FAQPage', 'Organization', 'SoftwareApplication'])
  })

  it('SoftwareApplication is free (price 0) and carries the page description and url', () => {
    const app = byType('SoftwareApplication') as Record<string, unknown> & { offers: Record<string, string> }
    expect(app.offers.price).toBe('0')
    expect(app.description).toBe(META_DESCRIPTION)
    expect(app.url).toBe('https://example.com')
  })

  it('FAQPage mirrors the visible FAQ exactly (same questions and answers, same order)', () => {
    const faqPage = byType('FAQPage') as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] }
    expect(faqPage.mainEntity.map((q) => q.name)).toEqual(FAQ.map((f) => f.question))
    expect(faqPage.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(FAQ.map((f) => f.answer))
  })
})

describe('homepage SEO copy', () => {
  const copyText = [
    ...SECTIONS.flatMap((s) => [s.heading, ...s.paragraphs]),
    FAQ_HEADING,
    ...FAQ.flatMap((f) => [f.question, f.answer]),
  ].join(' ')
  const words = copyText.split(/\s+/).filter((token) => /[a-z0-9]/i.test(token)).length
  const occurrences = (copyText.toLowerCase().match(/openwrt online builder/g) ?? []).length
  const density = (occurrences / words) * 100

  it('has at least 6 FAQ entries', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(6)
  })

  it('landing copy plus FAQ totals at least 800 words', () => {
    expect(words).toBeGreaterThanOrEqual(800)
  })

  it('keeps "openwrt online builder" density between 3% and 5%', () => {
    expect(density).toBeGreaterThanOrEqual(3)
    expect(density).toBeLessThanOrEqual(5)
  })

  it('title stays within 60 characters and contains the core keyword', () => {
    expect(HERO_TITLE.length).toBeLessThanOrEqual(60)
    expect(HERO_TITLE.toLowerCase()).toContain('openwrt online builder')
  })

  it('meta description is 150-160 characters and contains the core keyword', () => {
    expect(META_DESCRIPTION.length).toBeGreaterThanOrEqual(150)
    expect(META_DESCRIPTION.length).toBeLessThanOrEqual(160)
    expect(META_DESCRIPTION.toLowerCase()).toContain('openwrt online builder')
  })

  it('heading levels never skip (first section is h2; only h2/h3 are used)', () => {
    expect(SECTIONS[0].level).toBe(2)
    for (const section of SECTIONS) {
      expect([2, 3]).toContain(section.level)
    }
  })
})
