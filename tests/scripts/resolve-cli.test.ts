import { describe, expect, it } from 'vitest'
import { readArgs } from '../../scripts/build/resolve-cli'

describe('readArgs', () => {
  it('parses the ids JSON array and defaults ui language to en', () => {
    const out = readArgs({ COMMUNITY_IDS: '["openclash","smartdns"]', IB_ARCH: 'aarch64_cortex-a53', IB_VERSION: '25.12.5' })
    expect(out).toEqual({ ids: ['openclash', 'smartdns'], uiLanguage: 'en', arch: 'aarch64_cortex-a53', version: '25.12.5' })
  })

  it('respects UI_LANGUAGE when set', () => {
    const out = readArgs({ COMMUNITY_IDS: '[]', UI_LANGUAGE: 'zh-cn', IB_ARCH: 'x86_64', IB_VERSION: '25.12.5' })
    expect(out.uiLanguage).toBe('zh-cn')
  })

  it('throws when a required env var is missing', () => {
    expect(() => readArgs({ IB_ARCH: 'x86_64', IB_VERSION: '25.12.5' })).toThrow(/COMMUNITY_IDS/)
  })
})
