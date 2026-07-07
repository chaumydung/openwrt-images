import { describe, expect, it } from 'vitest'
import {
  SUPPORTED_LANGUAGES,
  getCuratedCategories,
  getCommunityComponents,
  getCommunityComponent,
  communityIds,
} from '@/lib/community-packages'

describe('curated catalog', () => {
  it('exposes non-empty categories with unique package names', () => {
    const cats = getCuratedCategories()
    expect(cats.length).toBeGreaterThan(0)
    const names = cats.flatMap((c) => c.packages.map((p) => p.name))
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('community catalog', () => {
  it('lists the nine seeded components with unique ids', () => {
    const comps = getCommunityComponents()
    expect(comps.map((c) => c.id).sort()).toEqual(
      ['argon-theme', 'homeproxy', 'mosdns', 'nikki', 'openclash', 'passwall', 'passwall2', 'smartdns', 'ssr-plus'].sort(),
    )
  })

  it('every component carries a valid source recipe and non-empty packages', () => {
    for (const c of getCommunityComponents()) {
      expect(c.packages.length).toBeGreaterThan(0)
      if (c.sourceType === 'feed') expect(c.feed.urlTemplate).toContain('{arch}')
      else expect(c.githubRepo).toMatch(/^[\w.-]+\/[\w.-]+$/)
      for (const lang of c.i18nAvailable) expect(SUPPORTED_LANGUAGES).toContain(lang)
    }
  })

  it('looks up by id and reports the id set', () => {
    expect(getCommunityComponent('openclash')?.label).toBe('OpenClash')
    expect(getCommunityComponent('nope')).toBeNull()
    expect(communityIds().has('passwall2')).toBe(true)
    expect(communityIds().has('nope')).toBe(false)
  })

  it('supported languages start with en', () => {
    expect(SUPPORTED_LANGUAGES[0]).toBe('en')
  })
})
