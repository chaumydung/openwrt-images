// Client-side loader for the compact device index served by /api/device-index,
// cached at module level so the builder fetches it at most once per session.
import type { BuilderDevice } from './lib'

let cached: Promise<BuilderDevice[]> | null = null

export function loadDeviceIndex(): Promise<BuilderDevice[]> {
  if (!cached) {
    cached = fetch('/api/device-index').then((res) => {
      if (!res.ok) throw new Error(`device index HTTP ${res.status}`)
      return res.json() as Promise<BuilderDevice[]>
    })
    cached.catch(() => {
      cached = null // allow a retry after a failed fetch
    })
  }
  return cached
}
