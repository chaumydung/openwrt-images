import { describe, expect, it, vi } from 'vitest'
import { recordReleaseAssets, syncCommunity } from '../../scripts/sync/community'

const openclash = {
  id: 'openclash', label: 'OpenClash', category: 'proxy', note: null,
  sourceType: 'github-release', githubRepo: 'vernesong/OpenClash',
  packages: ['luci-app-openclash'], extraDepends: [], i18nAvailable: ['zh-cn'],
  latest: { version: null, assets: [] },
} as const

const nikki = {
  id: 'nikki', label: 'Nikki (Mihomo)', category: 'proxy', note: null,
  sourceType: 'tarball', githubRepo: 'nikkinikki-org/OpenWrt-nikki',
  packages: ['luci-app-nikki'], extraDepends: ['dnsmasq-full'], i18nAvailable: [],
  latest: { version: null, assets: [] },
} as const

// Two recent releases where the newest dropped a format the older still has (the argon case):
// newest ships only .apk; the previous release still ships the _all.ipk.
const recentReleases = [
  { tag_name: 'v2.4.3', assets: [{ name: 'luci-theme-argon-2.4.3.apk', browser_download_url: 'https://x/luci-theme-argon-2.4.3.apk' }] },
  {
    tag_name: 'v2.3.2',
    assets: [
      { name: 'luci-theme-argon-2.3.2.apk', browser_download_url: 'https://x/luci-theme-argon-2.3.2.apk' },
      { name: 'luci-theme-argon_2.3.2_all.ipk', browser_download_url: 'https://x/luci-theme-argon_2.3.2_all.ipk' },
    ],
  },
]

describe('recordReleaseAssets', () => {
  it('unions assets across releases newest-first, deduped by name', () => {
    const dupd = [
      { tag_name: 'v2', assets: [{ name: 'a.apk', browser_download_url: 'https://x/v2/a.apk' }] },
      { tag_name: 'v1', assets: [
        { name: 'a.apk', browser_download_url: 'https://x/v1/a.apk' }, // duplicate name — v2 (newer) wins
        { name: 'a_all.ipk', browser_download_url: 'https://x/v1/a_all.ipk' },
      ] },
    ]
    expect(recordReleaseAssets(dupd)).toEqual([
      { name: 'a.apk', url: 'https://x/v2/a.apk' },
      { name: 'a_all.ipk', url: 'https://x/v1/a_all.ipk' },
    ])
  })
})

describe('syncCommunity', () => {
  it('queries recent releases, unions assets (both apk and older ipk) and leaves feed components untouched', async () => {
    const argon = { ...openclash, id: 'argon-theme', githubRepo: 'jerrykuku/luci-theme-argon', packages: ['luci-theme-argon'] }
    const feedComp = { ...openclash, id: 'smartdns', sourceType: 'feed',
      feed: { name: 'p', urlTemplate: 'https://f/{arch}', checkSignature: false } } as never
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => recentReleases })
    const out = await syncCommunity([argon as never, feedComp], fetchImpl)
    expect(out[0].latest.version).toBe('v2.4.3') // newest non-draft release
    // both the newest .apk and the older _all.ipk are present, so both build lines resolve
    const names = out[0].latest.assets.map((a) => a.name)
    expect(names).toContain('luci-theme-argon-2.4.3.apk')
    expect(names).toContain('luci-theme-argon_2.3.2_all.ipk')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repos/jerrykuku/luci-theme-argon/releases?per_page=8',
      expect.anything(),
    )
    expect(out[1].latest.version).toBeNull() // feed passthrough
  })

  it('skips draft releases when choosing the version', async () => {
    const withDraft = [{ tag_name: 'v9-draft', draft: true, assets: [] }, ...recentReleases]
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => withDraft })
    const out = await syncCommunity([{ ...openclash, id: 'argon-theme', githubRepo: 'jerrykuku/luci-theme-argon' } as never], fetchImpl)
    expect(out[0].latest.version).toBe('v2.4.3')
  })

  it('also refreshes tarball components', async () => {
    const tarballReleases = [{
      tag_name: 'v1.26.1',
      assets: [
        { name: 'nikki_aarch64_cortex-a53-openwrt-25.12.tar.gz', browser_download_url: 'https://x/nikki_aarch64_cortex-a53-openwrt-25.12.tar.gz' },
        { name: 'nikki_aarch64_cortex-a53-SNAPSHOT.tar.gz', browser_download_url: 'https://x/nikki_aarch64_cortex-a53-SNAPSHOT.tar.gz' },
      ],
    }]
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => tarballReleases })
    const out = await syncCommunity([nikki as never], fetchImpl)
    expect(out[0].latest.version).toBe('v1.26.1')
    expect(out[0].latest.assets).toEqual(recordReleaseAssets(tarballReleases))
  })
})
