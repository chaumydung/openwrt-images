import { describe, expect, it } from 'vitest'
import { resolveCommunity, versionLineCovers } from '@/../scripts/build/resolve-community'
import type { CommunityComponent } from '@/lib/community-packages'

const feed = {
  id: 'smartdns', label: 'SmartDNS', category: 'dns', note: null, sourceType: 'feed',
  feed: { name: 'op', urlTemplate: 'https://d/{version}/packages/{arch}/packages', checkSignature: false },
  packages: ['luci-app-smartdns'], extraDepends: [], i18nAvailable: ['zh-cn'], latest: { version: null, assets: [] },
} as CommunityComponent

// Real asset names verified via the GitHub API (Openwrt-Passwall/openwrt-passwall @ 26.7.1-1):
// its `_all` assets are prefixed by the OpenWrt version line(s) they target, so they don't start
// with `luci-app-passwall` directly.
const passwall = {
  id: 'passwall', label: 'PassWall', category: 'proxy', note: null, sourceType: 'github-release',
  githubRepo: 'Openwrt-Passwall/openwrt-passwall', packages: ['luci-app-passwall'], extraDepends: ['dnsmasq-full'],
  i18nAvailable: ['zh-cn'],
  latest: { version: '26.7.1-1', assets: [
    { name: '22.03-_luci-app-passwall_26.7.1_all.ipk', url: 'https://x/22.03-_luci-app-passwall_26.7.1_all.ipk' },
    { name: '22.03-_luci-i18n-passwall-zh-cn_26.7.1_all.ipk', url: 'https://x/22.03-_luci-i18n-passwall-zh-cn_26.7.1_all.ipk' },
    { name: '23.05-24.10_luci-app-passwall_26.7.1-r1_all.ipk', url: 'https://x/23.05-24.10_luci-app-passwall_26.7.1-r1_all.ipk' },
    { name: '23.05-24.10_luci-i18n-passwall-zh-cn_26.7.1_all.ipk', url: 'https://x/23.05-24.10_luci-i18n-passwall-zh-cn_26.7.1_all.ipk' },
    { name: '25.12+_luci-app-passwall-26.7.1-r1.apk', url: 'https://x/25.12+_luci-app-passwall-26.7.1-r1.apk' },
    { name: '25.12+_luci-i18n-passwall-zh-cn-26.7.1.apk', url: 'https://x/25.12+_luci-i18n-passwall-zh-cn-26.7.1.apk' },
  ] },
} as CommunityComponent

// Real asset names (vernesong/OpenClash @ v0.47.116, Openwrt-Passwall/openwrt-passwall2 @ 26.6.16-1):
// no version-line prefix — both an ipk and an apk `_all` variant ship for every OpenWrt version.
const openclash = {
  id: 'openclash', label: 'OpenClash', category: 'proxy', note: null, sourceType: 'github-release',
  githubRepo: 'vernesong/OpenClash', packages: ['luci-app-openclash'], extraDepends: ['dnsmasq-full'],
  i18nAvailable: ['zh-cn'],
  latest: { version: 'v0.47.116', assets: [
    { name: 'luci-app-openclash-0.47.116.apk', url: 'https://x/luci-app-openclash-0.47.116.apk' },
    { name: 'luci-app-openclash_0.47.116_all.ipk', url: 'https://x/luci-app-openclash_0.47.116_all.ipk' },
    { name: 'luci-i18n-openclash-zh-cn_0.47.116_all.ipk', url: 'https://x/luci-i18n-openclash-zh-cn_0.47.116_all.ipk' },
  ] },
} as CommunityComponent

const passwall2 = {
  id: 'passwall2', label: 'PassWall 2', category: 'proxy', note: null, sourceType: 'github-release',
  githubRepo: 'Openwrt-Passwall/openwrt-passwall2', packages: ['luci-app-passwall2'], extraDepends: ['dnsmasq-full'],
  i18nAvailable: ['zh-cn', 'zh-tw', 'ru'],
  latest: { version: '26.6.16-1', assets: [
    { name: 'luci-app-passwall2-26.6.16-r1.apk', url: 'https://x/luci-app-passwall2-26.6.16-r1.apk' },
    { name: 'luci-app-passwall2_26.6.16-r1_all.ipk', url: 'https://x/luci-app-passwall2_26.6.16-r1_all.ipk' },
  ] },
} as CommunityComponent

// Real asset names (nikkinikki-org/OpenWrt-nikki @ v1.26.1, sbwml/luci-app-mosdns @ v5.3.4-r5):
// per-arch tarballs only, no `_all` package.
const nikki = {
  id: 'nikki', label: 'Nikki (Mihomo)', category: 'proxy', note: null, sourceType: 'tarball',
  githubRepo: 'nikkinikki-org/OpenWrt-nikki', packages: ['luci-app-nikki'], extraDepends: ['dnsmasq-full'],
  i18nAvailable: ['zh-cn', 'zh-tw', 'ru'],
  latest: { version: 'v1.26.1', assets: [
    { name: 'nikki_aarch64_cortex-a53-openwrt-24.10.tar.gz', url: 'https://x/nikki_aarch64_cortex-a53-openwrt-24.10.tar.gz' },
    { name: 'nikki_aarch64_cortex-a53-openwrt-25.12.tar.gz', url: 'https://x/nikki_aarch64_cortex-a53-openwrt-25.12.tar.gz' },
    { name: 'nikki_aarch64_cortex-a53-SNAPSHOT.tar.gz', url: 'https://x/nikki_aarch64_cortex-a53-SNAPSHOT.tar.gz' },
    { name: 'nikki_x86_64-openwrt-25.12.tar.gz', url: 'https://x/nikki_x86_64-openwrt-25.12.tar.gz' },
  ] },
} as CommunityComponent

const mosdns = {
  id: 'mosdns', label: 'MosDNS', category: 'dns', note: null, sourceType: 'tarball',
  githubRepo: 'sbwml/luci-app-mosdns', packages: ['luci-app-mosdns'], extraDepends: [],
  i18nAvailable: [],
  latest: { version: 'v5.3.4-r5', assets: [
    { name: 'aarch64_cortex-a53-openwrt-24.10.tar.gz', url: 'https://x/aarch64_cortex-a53-openwrt-24.10.tar.gz' },
    { name: 'aarch64_cortex-a53-openwrt-25.12.tar.gz', url: 'https://x/aarch64_cortex-a53-openwrt-25.12.tar.gz' },
    { name: 'x86_64-openwrt-25.12.tar.gz', url: 'https://x/x86_64-openwrt-25.12.tar.gz' },
  ] },
} as CommunityComponent

describe('versionLineCovers', () => {
  it('handles an exact version line', () => {
    expect(versionLineCovers('22.03', '22.03')).toBe(true)
    expect(versionLineCovers('22.03', '23.05')).toBe(false)
  })

  it('handles an inclusive range', () => {
    expect(versionLineCovers('23.05-24.10', '23.05')).toBe(true)
    expect(versionLineCovers('23.05-24.10', '24.10')).toBe(true)
    expect(versionLineCovers('23.05-24.10', '22.03')).toBe(false)
    expect(versionLineCovers('23.05-24.10', '25.12')).toBe(false)
  })

  it('handles an open-ended lower bound', () => {
    expect(versionLineCovers('25.12+', '25.12')).toBe(true)
    expect(versionLineCovers('25.12+', '26.1')).toBe(true)
    expect(versionLineCovers('25.12+', '24.10')).toBe(false)
  })
})

describe('resolveCommunity', () => {
  it('emits a feed entry (arch+version substituted) and package name', () => {
    const out = resolveCommunity([feed], ['smartdns'], 'en', 'aarch64_cortex-a53', '25.12.5')
    expect(out.feeds).toEqual([{ name: 'op', url: 'https://d/25.12.5/packages/aarch64_cortex-a53/packages', checkSignature: false }])
    expect(out.packages).toContain('luci-app-smartdns')
  })

  it('ignores unknown ids', () => {
    expect(resolveCommunity([feed], ['nope'], 'en', 'x86_64', '25.12.5').packages).toEqual([])
  })

  it('passwall: picks the 25.12+ apk asset for version 25.12.5 (apk format)', () => {
    const out = resolveCommunity([passwall], ['passwall'], 'en', 'x86_64', '25.12.5')
    expect(out.assetUrls).toEqual(['https://x/25.12+_luci-app-passwall-26.7.1-r1.apk'])
  })

  it('passwall: picks the 23.05-24.10 ipk asset for version 24.10.7 (ipk format)', () => {
    const out = resolveCommunity([passwall], ['passwall'], 'en', 'x86_64', '24.10.7')
    expect(out.assetUrls).toEqual(['https://x/23.05-24.10_luci-app-passwall_26.7.1-r1_all.ipk'])
  })

  it('passwall: includes the matching version-line i18n asset for a non-en language', () => {
    const out = resolveCommunity([passwall], ['passwall'], 'zh-cn', 'x86_64', '25.12.5')
    expect(out.assetUrls).toContain('https://x/25.12+_luci-i18n-passwall-zh-cn-26.7.1.apk')
    expect(out.assetUrls).not.toContain('https://x/22.03-_luci-i18n-passwall-zh-cn_26.7.1_all.ipk')
  })

  it('openclash/passwall2: still pick their _all asset by format, unaffected by the new prefix logic', () => {
    const outIpk = resolveCommunity([openclash, passwall2], ['openclash', 'passwall2'], 'en', 'x86_64', '24.10.7')
    expect(outIpk.assetUrls).toEqual(
      expect.arrayContaining([
        'https://x/luci-app-openclash_0.47.116_all.ipk',
        'https://x/luci-app-passwall2_26.6.16-r1_all.ipk',
      ]),
    )
    const outApk = resolveCommunity([openclash, passwall2], ['openclash', 'passwall2'], 'en', 'x86_64', '25.12.5')
    expect(outApk.assetUrls).toEqual(
      expect.arrayContaining([
        'https://x/luci-app-openclash-0.47.116.apk',
        'https://x/luci-app-passwall2-26.6.16-r1.apk',
      ]),
    )
  })

  it('nikki/mosdns: pick the arch+versionLine tarball, not the SNAPSHOT or another arch', () => {
    const out = resolveCommunity([nikki, mosdns], ['nikki', 'mosdns'], 'en', 'aarch64_cortex-a53', '25.12.5')
    expect(out.tarballUrls).toEqual(
      expect.arrayContaining([
        'https://x/nikki_aarch64_cortex-a53-openwrt-25.12.tar.gz',
        'https://x/aarch64_cortex-a53-openwrt-25.12.tar.gz',
      ]),
    )
    expect(out.tarballUrls).not.toContain('https://x/nikki_aarch64_cortex-a53-SNAPSHOT.tar.gz')
    expect(out.assetUrls).toEqual([])
    expect(out.packages).toEqual(expect.arrayContaining(['luci-app-nikki', 'luci-app-mosdns']))
  })
})
