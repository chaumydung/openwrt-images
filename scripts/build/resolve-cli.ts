// CLI wrapper for build-firmware.yml: reads resolver inputs from env vars (COMMUNITY_IDS, UI_LANGUAGE,
// IB_ARCH, IB_VERSION) and prints resolveCommunity's output as JSON on stdout. Invoked via
// `npx tsx scripts/build/resolve-cli.ts` since the resolver and the catalog reader are TypeScript.
import { resolveCommunity } from './resolve-community'
import { getCommunityComponents } from '../../src/lib/community-packages'

export function readArgs(env: Record<string, string | undefined>): {
  ids: string[]
  uiLanguage: string
  arch: string
  version: string
} {
  const idsRaw = env.COMMUNITY_IDS
  const arch = env.IB_ARCH
  const version = env.IB_VERSION
  if (!idsRaw) throw new Error('missing required env var: COMMUNITY_IDS')
  if (!arch) throw new Error('missing required env var: IB_ARCH')
  if (!version) throw new Error('missing required env var: IB_VERSION')
  return { ids: JSON.parse(idsRaw), uiLanguage: env.UI_LANGUAGE || 'en', arch, version }
}

function main() {
  const { ids, uiLanguage, arch, version } = readArgs(process.env)
  const result = resolveCommunity(getCommunityComponents(), ids, uiLanguage, arch, version)
  process.stdout.write(JSON.stringify(result))
}

if (process.argv[1]?.endsWith('resolve-cli.ts')) main()
