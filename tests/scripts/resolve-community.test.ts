import { describe, expect, it } from 'vitest'
import { resolveCommunity } from '@/../scripts/build/resolve-community'
import type { CommunityComponent } from '@/lib/community-packages'

const feed = {
  id: 'smartdns', label: 'SmartDNS', category: 'dns', note: null, sourceType: 'feed',
  feed: { name: 'op', urlTemplate: 'https://d/{version}/packages/{arch}/packages', checkSignature: false },
  packages: ['luci-app-smartdns'], extraDepends: [], i18nAvailable: ['zh-cn'], latest: { version: null, assets: {} },
} as CommunityComponent

const release = {
  id: 'openclash', label: 'OpenClash', category: 'proxy', note: null, sourceType: 'github-release',
  githubRepo: 'vernesong/OpenClash', packages: ['luci-app-openclash'], extraDepends: ['dnsmasq-full'],
  i18nAvailable: ['zh-cn'],
  latest: { version: 'v1', assets: {
    'luci-app-openclash': 'https://x/luci-app-openclash_all.ipk',
    'luci-i18n-openclash-zh-cn': 'https://x/luci-i18n-openclash-zh-cn_all.ipk',
  } },
} as CommunityComponent

describe('resolveCommunity', () => {
  const comps = [feed, release]

  it('emits a feed entry (arch+version substituted) and package name', () => {
    const out = resolveCommunity(comps, ['smartdns'], 'en', 'aarch64_cortex-a53', '25.12.5')
    expect(out.feeds).toEqual([{ name: 'op', url: 'https://d/25.12.5/packages/aarch64_cortex-a53/packages', checkSignature: false }])
    expect(out.packages).toContain('luci-app-smartdns')
  })

  it('emits release asset urls + extraDepends and skips i18n when en', () => {
    const out = resolveCommunity(comps, ['openclash'], 'en', 'x86_64', '25.12.5')
    expect(out.assetUrls).toEqual(['https://x/luci-app-openclash_all.ipk'])
    expect(out.packages).toContain('luci-app-openclash')
    expect(out.extraDepends).toContain('dnsmasq-full')
  })

  it('includes the i18n asset when a non-en language is chosen', () => {
    const out = resolveCommunity(comps, ['openclash'], 'zh-cn', 'x86_64', '25.12.5')
    expect(out.assetUrls).toContain('https://x/luci-i18n-openclash-zh-cn_all.ipk')
  })

  it('ignores unknown ids', () => {
    expect(resolveCommunity(comps, ['nope'], 'en', 'x86_64', '25.12.5').packages).toEqual([])
  })
})
