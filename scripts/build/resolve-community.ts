// Pure resolver used by build-firmware.yml: turns selected community ids + language + target arch
// into the feeds to add, the _all asset URLs to download, and the package/dependency names to install.
import type { CommunityComponent } from '../../src/lib/community-packages'

export type ResolvedCommunity = {
  feeds: { name: string; url: string; checkSignature: boolean }[]
  assetUrls: string[]
  packages: string[]
  extraDepends: string[]
}

export function resolveCommunity(
  components: CommunityComponent[],
  ids: string[],
  uiLanguage: string,
  arch: string,
  version: string,
): ResolvedCommunity {
  const chosen = components.filter((c) => ids.includes(c.id))
  const feeds: ResolvedCommunity['feeds'] = []
  const assetUrls: string[] = []
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
    } else {
      for (const pkg of c.packages) {
        const main = c.latest.assets[pkg]
        if (main) assetUrls.push(main)
      }
      if (uiLanguage !== 'en') {
        for (const key of Object.keys(c.latest.assets)) {
          if (key.startsWith('luci-i18n-') && key.endsWith(`-${uiLanguage}`)) assetUrls.push(c.latest.assets[key])
        }
      }
    }
    // i18n for feed-type components resolves via the feed at install time; add the package name.
    if (c.sourceType === 'feed' && uiLanguage !== 'en' && c.i18nAvailable.includes(uiLanguage)) {
      packages.push(...c.packages.map((p) => p.replace(/^luci-app-/, 'luci-i18n-') + `-${uiLanguage}`))
    }
  }

  return {
    feeds,
    assetUrls: [...new Set(assetUrls)],
    packages: [...new Set(packages)],
    extraDepends: [...new Set(extraDepends)],
  }
}
