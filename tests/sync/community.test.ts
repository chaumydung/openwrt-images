import { describe, expect, it, vi } from 'vitest'
import { parseReleaseAssets, syncCommunity } from '../../scripts/sync/community'

const openclash = {
  id: 'openclash', label: 'OpenClash', category: 'proxy', note: null,
  sourceType: 'github-release', githubRepo: 'vernesong/OpenClash',
  packages: ['luci-app-openclash'], extraDepends: [], i18nAvailable: ['zh-cn'],
  latest: { version: null, assets: {} },
} as const

const release = {
  tag_name: 'v0.47.110',
  assets: [
    { name: 'luci-app-openclash_0.47.110_all.ipk', browser_download_url: 'https://x/luci-app-openclash_0.47.110_all.ipk' },
    { name: 'luci-app-openclash-0.47.110.apk', browser_download_url: 'https://x/luci-app-openclash-0.47.110.apk' },
    { name: 'luci-i18n-openclash-zh-cn_0.47.110_all.ipk', browser_download_url: 'https://x/luci-i18n-openclash-zh-cn_0.47.110_all.ipk' },
  ],
}

describe('parseReleaseAssets', () => {
  it('maps package and i18n _all assets by key', () => {
    const out = parseReleaseAssets(openclash as never, release, ['zh-cn'])
    expect(out.version).toBe('v0.47.110')
    expect(out.assets['luci-app-openclash']).toContain('luci-app-openclash_0.47.110_all.ipk')
    expect(out.assets['luci-i18n-openclash-zh-cn']).toContain('luci-i18n-openclash-zh-cn')
  })

  it('does not let a same-prefix variant package win over the exact base match', () => {
    // The variant appears before the exact asset in listing order, so a naive `.find` would
    // pick it first; the exact base must still win.
    const releaseWithVariant = {
      tag_name: 'v0.47.110',
      assets: [
        {
          name: 'luci-app-openclash-nftables_0.47.110_all.ipk',
          browser_download_url: 'https://x/luci-app-openclash-nftables_0.47.110_all.ipk',
        },
        ...release.assets,
      ],
    }
    const out = parseReleaseAssets(openclash as never, releaseWithVariant, ['zh-cn'])
    expect(out.assets['luci-app-openclash']).toBe('https://x/luci-app-openclash_0.47.110_all.ipk')
  })
})

describe('syncCommunity', () => {
  it('refreshes github-release latest and leaves feed components untouched', async () => {
    const feedComp = { ...openclash, id: 'smartdns', sourceType: 'feed',
      feed: { name: 'p', urlTemplate: 'https://f/{arch}', checkSignature: false } } as never
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => release })
    const out = await syncCommunity([openclash as never, feedComp], fetchImpl)
    expect(out[0].latest.version).toBe('v0.47.110')
    expect(fetchImpl).toHaveBeenCalledWith('https://api.github.com/repos/vernesong/OpenClash/releases/latest', expect.anything())
    expect(out[1].latest.version).toBeNull() // feed passthrough
  })
})
