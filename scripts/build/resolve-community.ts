// Pure resolver used by build-firmware.yml: turns selected community ids + language + target arch
// into the feeds to add, the asset/tarball URLs to download, and the package/dependency names to
// install. Asset SELECTION lives here (not in sync) because only the resolver knows the target
// arch/version/format — sync just records every release asset verbatim.
import type { CommunityComponent } from '../../src/lib/community-packages'

export type ResolvedCommunity = {
  feeds: { name: string; url: string; checkSignature: boolean }[]
  assetUrls: string[]
  tarballUrls: string[]
  packages: string[]
  extraDepends: string[]
}

type Asset = { name: string; url: string }

// "25.12.5" -> "25.12", "24.10.7" -> "24.10"
function versionLineOf(version: string): string {
  return version.split('.').slice(0, 2).join('.')
}

// OpenWrt switched its ImageBuilder package format from ipk to apk on the 25.x release line
// (major >= 25); 24.10 and every earlier line still use ipk.
function packageFormat(versionLine: string): 'ipk' | 'apk' {
  return Number(versionLine.split('.')[0]) >= 25 ? 'apk' : 'ipk'
}

function compareVersionLine(a: string, b: string): number {
  const [aMaj, aMin] = a.split('.').map(Number)
  const [bMaj, bMin] = b.split('.').map(Number)
  return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin
}

// A github-release asset name may be prefixed by the OpenWrt version line(s) it targets, in one of
// three shapes: exact ("22.03"), inclusive range ("23.05-24.10"), or open-ended ("25.12+").
export function versionLineCovers(prefixToken: string, versionLine: string): boolean {
  if (prefixToken.endsWith('+')) return compareVersionLine(versionLine, prefixToken.slice(0, -1)) >= 0
  const [lo, hi] = prefixToken.split('-')
  if (hi) return compareVersionLine(versionLine, lo) >= 0 && compareVersionLine(versionLine, hi) <= 0
  return versionLine === prefixToken
}

// Splits a leading version-line token (see versionLineCovers) off an asset name, e.g.
// "23.05-24.10_luci-app-passwall_..." -> { token: "23.05-24.10", rest: "luci-app-passwall_..." }.
// Names with no such prefix (e.g. "luci-app-openclash_..._all.ipk") are returned with token: null.
function stripVersionLinePrefix(name: string): { token: string | null; rest: string } {
  const m = /^(\d{2}\.\d{2}(?:-\d{2}\.\d{2})?\+?)[-_]+(.*)$/.exec(name)
  return m ? { token: m[1], rest: m[2] } : { token: null, rest: name }
}

function matchesFormat(name: string, format: 'ipk' | 'apk'): boolean {
  return format === 'ipk' ? name.endsWith('_all.ipk') : name.endsWith('.apk')
}

// `pkg` must appear at the very start of `rest`, immediately followed by a version separator and a
// digit — this rejects a same-prefix variant package (e.g. `luci-app-openclash-nftables_...`)
// matching a shorter base name.
function nameMatchesPackage(rest: string, pkg: string): boolean {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped}[-_]\\d`).test(rest)
}

// Picks the arch-independent asset for `pkg` at the given OpenWrt version line + package format.
function pickReleaseAsset(assets: Asset[], pkg: string, versionLine: string, format: 'ipk' | 'apk'): string | null {
  const match = assets.find((a) => {
    if (!matchesFormat(a.name, format)) return false
    const { token, rest } = stripVersionLinePrefix(a.name)
    if (!nameMatchesPackage(rest, pkg)) return false
    return !token || versionLineCovers(token, versionLine)
  })
  return match?.url ?? null
}

// Picks the per-arch tarball matching both the target arch and OpenWrt version line. Matches the
// combined `${arch}-openwrt-${versionLine}` substring in a single check rather than two independent
// `.includes()` calls, because an arch name can be a substring of a sibling variant's name (e.g.
// `arm_cortex-a9` is a prefix of `arm_cortex-a9_neon` and `arm_cortex-a9_vfpv3-d16`). The naming
// convention joins arch to `-openwrt-` with a `-` while variant suffixes use `_`, so the combined
// substring only ever appears in the exact-arch asset name.
function pickTarball(assets: Asset[], arch: string, versionLine: string): string | null {
  const match = assets.find(
    (a) =>
      a.name.includes(`${arch}-openwrt-${versionLine}`) &&
      a.name.endsWith('.tar.gz') &&
      !a.name.includes('SNAPSHOT'),
  )
  return match?.url ?? null
}

export function resolveCommunity(
  components: CommunityComponent[],
  ids: string[],
  uiLanguage: string,
  arch: string,
  version: string,
): ResolvedCommunity {
  const chosen = components.filter((c) => ids.includes(c.id))
  const versionLine = versionLineOf(version)
  const format = packageFormat(versionLine)
  const feeds: ResolvedCommunity['feeds'] = []
  const assetUrls: string[] = []
  const tarballUrls: string[] = []
  const packages: string[] = []
  const extraDepends: string[] = []

  for (const c of chosen) {
    packages.push(...c.packages)
    extraDepends.push(...c.extraDepends)

    if (c.sourceType === 'feed') {
      feeds.push({
        name: c.feed.name,
        url: c.feed.urlTemplate.replaceAll('{arch}', arch).replaceAll('{version}', version),
        checkSignature: c.feed.checkSignature,
      })
      // i18n for feed-type components resolves via the feed at install time; add the package name.
      if (uiLanguage !== 'en' && c.i18nAvailable.includes(uiLanguage)) {
        packages.push(...c.packages.map((p) => p.replace(/^luci-app-/, 'luci-i18n-') + `-${uiLanguage}`))
      }
      continue
    }

    if (c.sourceType === 'tarball') {
      // The inner ipks/apks get installed by name (c.packages, pushed above) after extraction.
      // Per-arch tarballs bundle all UI languages, so c.i18nAvailable is informational only here —
      // the resolver intentionally does no i18n asset selection for tarball components.
      const url = pickTarball(c.latest.assets, arch, versionLine)
      if (url) tarballUrls.push(url)
      continue
    }

    // github-release
    for (const pkg of c.packages) {
      const url = pickReleaseAsset(c.latest.assets, pkg, versionLine, format)
      if (url) assetUrls.push(url)
    }
    if (uiLanguage !== 'en') {
      for (const pkg of c.packages) {
        const i18nPkg = pkg.replace(/^luci-app-/, 'luci-i18n-') + `-${uiLanguage}`
        const url = pickReleaseAsset(c.latest.assets, i18nPkg, versionLine, format)
        if (url) assetUrls.push(url)
      }
    }
  }

  return {
    feeds,
    assetUrls: [...new Set(assetUrls)],
    tarballUrls: [...new Set(tarballUrls)],
    packages: [...new Set(packages)],
    extraDepends: [...new Set(extraDepends)],
  }
}
