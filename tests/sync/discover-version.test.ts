import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseIndexHrefs, pickLatestStable } from '../../scripts/sync/discover-version'

describe('parseIndexHrefs', () => {
  it('extracts directory names from a real autoindex page', () => {
    const html = readFileSync('tests/fixtures/openwrt-releases-index.html', 'utf8')
    const hrefs = parseIndexHrefs(html)
    expect(hrefs.length).toBeGreaterThan(5)
    expect(hrefs.some((h) => /^\d+\.\d+\.\d+$/.test(h))).toBe(true)
  })
})

describe('pickLatestStable', () => {
  it('picks highest semver and ignores rc/snapshot/non-version dirs', () => {
    const dirs = ['17.01.7', '23.05.5', '24.10.0', '24.10.0-rc7', '24.10.1', 'faillogs', 'packages-24.10']
    expect(pickLatestStable(dirs)).toBe('24.10.1')
  })

  it('returns null when nothing matches', () => {
    expect(pickLatestStable(['foo', 'bar-rc1'])).toBeNull()
  })
})
