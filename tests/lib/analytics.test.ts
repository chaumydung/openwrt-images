// Tests for the trackEvent dataLayer helper: no-op guards and pushed payload shape.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { trackEvent } from '../../src/lib/analytics'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('trackEvent', () => {
  it('does not push outside production even when dataLayer exists', () => {
    const dataLayer: Record<string, unknown>[] = []
    vi.stubGlobal('window', { dataLayer })
    trackEvent({ event: 'build_succeeded' })
    expect(dataLayer).toHaveLength(0)
  })

  it('does not throw during SSR (no window) in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => trackEvent({ event: 'login_completed' })).not.toThrow()
  })

  it('does not throw in production when GTM has not defined dataLayer', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubGlobal('window', {})
    expect(() => trackEvent({ event: 'feedback_submitted' })).not.toThrow()
  })

  it('pushes the event name flattened with its params in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const dataLayer: Record<string, unknown>[] = []
    vi.stubGlobal('window', { dataLayer })
    trackEvent({ event: 'build_submitted', distro: 'openwrt', target: 'ramips/mt7621', profile: 'xiaomi_mi-router-4a-gigabit' })
    trackEvent({ event: 'prebuilt_download', slug: 'gl-inet-gl-mt3000', variant: 'sysupgrade' })
    expect(dataLayer).toEqual([
      { event: 'build_submitted', distro: 'openwrt', target: 'ramips/mt7621', profile: 'xiaomi_mi-router-4a-gigabit' },
      { event: 'prebuilt_download', slug: 'gl-inet-gl-mt3000', variant: 'sysupgrade' },
    ])
  })
})
