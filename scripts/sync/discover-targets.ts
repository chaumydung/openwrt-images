// Discovers all target/subtarget pairs for a distro release by walking the downloads index.
import { fetchText } from './http'
import { parseIndexHrefs } from './discover-version'
import type { DistroConfig } from './types'
import { mapLimit } from './map-limit'

export async function discoverTargets(distro: DistroConfig, version: string): Promise<string[]> {
  const base = `${distro.baseUrl}/releases/${version}/targets/`
  const targets = parseIndexHrefs(await fetchText(base))
  const nested = await mapLimit(targets, 8, async (target) => {
    const subtargets = parseIndexHrefs(await fetchText(`${base}${target}/`))
    return subtargets.map((sub) => `${target}/${sub}`)
  })
  return nested.flat().sort()
}
