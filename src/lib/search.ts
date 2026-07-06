// Tokenized device search with relevance ranking; replaces the naive substring match in catalog.ts.
import type { CatalogDevice } from './catalog-types'

// Lowercase and collapse every non-alphanumeric run (-._/,() spaces, etc.) into a single space.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean)
}

// Per-token match quality against the device tokens: 3 exact, 2 prefix, 1 in-token substring, 0 miss.
function tokenQuality(queryToken: string, tokens: string[]): number {
  let best = 0
  for (const t of tokens) {
    if (t === queryToken) return 3
    if (best < 2 && t.startsWith(queryToken)) best = 2
    else if (best < 1 && t.includes(queryToken)) best = 1
  }
  return best
}

// Relevance score (lower = better): 0 model equals query, 1 all tokens exact, 2 all tokens
// exact/prefix, 3 in-token substring, 4 compact-only (query typed without separators, e.g. "glmt3000").
// Returns null when the device does not match.
function score(modelNorm: string, tokens: string[], compact: string, qTokens: string[], qNorm: string, qCompact: string): number | null {
  if (modelNorm === qNorm) return 0
  let weakest = 3
  for (const qt of qTokens) {
    weakest = Math.min(weakest, tokenQuality(qt, tokens))
    if (weakest === 0) break
  }
  if (weakest > 0) return 4 - weakest
  return compact.includes(qCompact) ? 4 : null
}

// Generic over any device-shaped record so the client-side builder can search the compact
// device index (same fields, no image lists) without shipping the full catalog type.
export function searchDevices<T extends Pick<CatalogDevice, 'vendor' | 'model' | 'variant'>>(
  devices: T[],
  query: string,
  limit = 20,
): T[] {
  const qTokens = tokenize(query)
  if (qTokens.length === 0) return []
  const qNorm = qTokens.join(' ')
  const qCompact = qTokens.join('')
  const matches: { device: T; score: number; sortKey: string }[] = []
  for (const device of devices) {
    const tokens = tokenize(`${device.vendor} ${device.model} ${device.variant ?? ''}`)
    const s = score(normalize(device.model), tokens, tokens.join(''), qTokens, qNorm, qCompact)
    if (s !== null) matches.push({ device, score: s, sortKey: tokens.join(' ') })
  }
  matches.sort((a, b) => a.score - b.score || (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
  return matches.slice(0, limit).map((m) => m.device)
}
