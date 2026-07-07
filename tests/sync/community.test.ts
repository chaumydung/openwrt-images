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

const release = {
  tag_name: 'v0.47.116',
  assets: [
    { name: 'luci-app-openclash-0.47.116.apk', browser_download_url: 'https://x/luci-app-openclash-0.47.116.apk' },
    { name: 'luci-app-openclash_0.47.116_all.ipk', browser_download_url: 'https://x/luci-app-openclash_0.47.116_all.ipk' },
  ],
}

const tarballRelease = {
  tag_name: 'v1.26.1',
  assets: [
    { name: 'nikki_aarch64_cortex-a53-openwrt-25.12.tar.gz', browser_download_url: 'https://x/nikki_aarch64_cortex-a53-openwrt-25.12.tar.gz' },
    { name: 'nikki_aarch64_cortex-a53-SNAPSHOT.tar.gz', browser_download_url: 'https://x/nikki_aarch64_cortex-a53-SNAPSHOT.tar.gz' },
  ],
}

describe('recordReleaseAssets', () => {
  it('records every asset verbatim, without picking one', () => {
    const out = recordReleaseAssets(release)
    expect(out).toEqual([
      { name: 'luci-app-openclash-0.47.116.apk', url: 'https://x/luci-app-openclash-0.47.116.apk' },
      { name: 'luci-app-openclash_0.47.116_all.ipk', url: 'https://x/luci-app-openclash_0.47.116_all.ipk' },
    ])
  })
})

describe('syncCommunity', () => {
  it('refreshes github-release latest with the full asset list and leaves feed components untouched', async () => {
    const feedComp = { ...openclash, id: 'smartdns', sourceType: 'feed',
      feed: { name: 'p', urlTemplate: 'https://f/{arch}', checkSignature: false } } as never
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => release })
    const out = await syncCommunity([openclash as never, feedComp], fetchImpl)
    expect(out[0].latest.version).toBe('v0.47.116')
    expect(out[0].latest.assets).toEqual(recordReleaseAssets(release))
    expect(fetchImpl).toHaveBeenCalledWith('https://api.github.com/repos/vernesong/OpenClash/releases/latest', expect.anything())
    expect(out[1].latest.version).toBeNull() // feed passthrough
  })

  it('also refreshes tarball components', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => tarballRelease })
    const out = await syncCommunity([nikki as never], fetchImpl)
    expect(out[0].latest.version).toBe('v1.26.1')
    expect(out[0].latest.assets).toEqual(recordReleaseAssets(tarballRelease))
    expect(fetchImpl).toHaveBeenCalledWith('https://api.github.com/repos/nikkinikki-org/OpenWrt-nikki/releases/latest', expect.anything())
  })
})
