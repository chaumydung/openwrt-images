// Unit tests for the homepage builder's pure logic (src/components/builder/lib.ts)
// plus one light render smoke of the distro step (no jsdom, static markup only).
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CommunityStep from '../../src/components/builder/community-step'
import DistroStep from '../../src/components/builder/distro-step'
import {
  addPackageToken,
  applyPreset,
  buildRequestBody,
  canEnterStep,
  EMPTY_CONFIG,
  filterPackages,
  formatSize,
  isPresetApplied,
  isValidPackageToken,
  relativeUntil,
  removePackageToken,
  removePreset,
  selectedBuild,
  stepComplete,
  toggleId,
  validateConfig,
  validateConfigField,
} from '../../src/components/builder/lib'
import type { BuilderDevice, DistroOption } from '../../src/components/builder/lib'

const DEVICE: BuilderDevice = {
  slug: 'acme-router-1',
  vendor: 'Acme',
  model: 'Router 1',
  variant: null,
  builds: [{ distro: 'openwrt', version: '25.12.5', target: 'ramips/mt7621', profileId: 'acme_router-1' }],
}

const DISTROS: DistroOption[] = [
  { id: 'openwrt', label: 'OpenWrt', version: '25.12.5' },
  { id: 'immortalwrt', label: 'ImmortalWrt', version: '25.12.1' },
]

describe('config prevalidation (mirrors /api/builds rules)', () => {
  it('accepts an all-empty config — every field is optional', () => {
    expect(validateConfig(EMPTY_CONFIG)).toEqual({})
  })

  it('validates hostname: RFC-952 charset, no edge hyphens, max 63', () => {
    expect(validateConfigField('hostname', 'my-router')).toBeNull()
    expect(validateConfigField('hostname', '-bad')).not.toBeNull()
    expect(validateConfigField('hostname', 'bad-')).not.toBeNull()
    expect(validateConfigField('hostname', 'a'.repeat(64))).not.toBeNull()
    expect(validateConfigField('hostname', 'has space')).not.toBeNull()
  })

  it('validates lanIp: private IPv4 only', () => {
    expect(validateConfigField('lanIp', '192.168.1.1')).toBeNull()
    expect(validateConfigField('lanIp', '10.0.0.1')).toBeNull()
    expect(validateConfigField('lanIp', '172.16.0.1')).toBeNull()
    expect(validateConfigField('lanIp', '8.8.8.8')).not.toBeNull()
    expect(validateConfigField('lanIp', '192.168.1')).not.toBeNull()
    expect(validateConfigField('lanIp', '10.0.0.256')).not.toBeNull()
  })

  it('validates lengths: SSID ≤32, passwords ≤63, timezone ≤64', () => {
    expect(validateConfigField('wifiSsid', 'a'.repeat(32))).toBeNull()
    expect(validateConfigField('wifiSsid', 'a'.repeat(33))).not.toBeNull()
    expect(validateConfigField('rootPassword', 'a'.repeat(63))).toBeNull()
    expect(validateConfigField('rootPassword', 'a'.repeat(64))).not.toBeNull()
    expect(validateConfigField('wifiPassword', 'a'.repeat(64))).not.toBeNull()
    expect(validateConfigField('timezone', 'Europe/Berlin')).toBeNull()
    expect(validateConfigField('timezone', 'a'.repeat(65))).not.toBeNull()
  })

  it('trims non-password fields before validating, keeps password whitespace', () => {
    expect(validateConfigField('lanIp', ' 192.168.1.1 ')).toBeNull()
    expect(validateConfigField('hostname', '  ')).toBeNull() // whitespace-only = unset
    expect(validateConfig({ ...EMPTY_CONFIG, hostname: 'ok', lanIp: 'nope' })).toEqual({
      lanIp: expect.stringContaining('private IPv4'),
    })
  })
})

describe('package tokens', () => {
  it('validates token syntax including the "-pkg" exclusion form', () => {
    expect(isValidPackageToken('luci-app-sqm')).toBe(true)
    expect(isValidPackageToken('-ppp')).toBe(true)
    expect(isValidPackageToken('libstdc++6')).toBe(true)
    expect(isValidPackageToken('bad name!')).toBe(false)
    expect(isValidPackageToken('')).toBe(false)
  })

  it('addPackageToken dedupes and drops the include/exclude counterpart', () => {
    expect(addPackageToken(['luci'], 'luci')).toEqual(['luci'])
    expect(addPackageToken(['-ppp'], 'ppp')).toEqual(['ppp'])
    expect(addPackageToken(['luci', 'htop'], '-luci')).toEqual(['htop', '-luci'])
  })

  it('removePackageToken removes exactly the given token', () => {
    expect(removePackageToken(['luci', '-ppp'], '-ppp')).toEqual(['luci'])
    expect(removePackageToken(['luci'], 'htop')).toEqual(['luci'])
  })

  it('presets: apply adds only missing packages, remove strips them, applied detects state', () => {
    const preset = ['luci', 'luci-ssl']
    const applied = applyPreset(['luci'], preset)
    expect(applied).toEqual(['luci', 'luci-ssl'])
    expect(isPresetApplied(applied, preset)).toBe(true)
    expect(isPresetApplied(['luci'], preset)).toBe(false)
    expect(isPresetApplied(applied, [])).toBe(false) // empty preset is never "applied"
    expect(removePreset(applied, preset)).toEqual([])
  })
})

describe('steps and request assembly', () => {
  it('selectedBuild matches the distro or returns null', () => {
    expect(selectedBuild(DEVICE, 'openwrt')?.profileId).toBe('acme_router-1')
    expect(selectedBuild(DEVICE, 'immortalwrt')).toBeNull()
    expect(selectedBuild(null, 'openwrt')).toBeNull()
  })

  it('stepComplete: device step needs a build for the chosen distro; config step needs a valid config', () => {
    const base = { distro: 'openwrt' as const, device: DEVICE, config: EMPTY_CONFIG }
    expect(stepComplete(2, { ...base, device: null })).toBe(false)
    expect(stepComplete(2, { ...base, distro: 'immortalwrt' })).toBe(false)
    expect(stepComplete(2, base)).toBe(true)
    expect(stepComplete(4, base)).toBe(true)
    expect(stepComplete(4, { ...base, config: { ...EMPTY_CONFIG, lanIp: 'nope' } })).toBe(false)
  })

  it('canEnterStep gates on every earlier step', () => {
    const noDevice = { distro: 'openwrt' as const, device: null, config: EMPTY_CONFIG }
    expect(canEnterStep(2, noDevice)).toBe(true)
    expect(canEnterStep(3, noDevice)).toBe(false)
    expect(canEnterStep(4, { ...noDevice, device: DEVICE })).toBe(true)
  })

  it('buildRequestBody trims values, drops empties, and omits empty packages/config', () => {
    const minimal = buildRequestBody({ distro: 'openwrt', device: DEVICE, packages: [], config: EMPTY_CONFIG })
    expect(minimal).toEqual({ distro: 'openwrt', version: '25.12.5', target: 'ramips/mt7621', profileId: 'acme_router-1' })

    const full = buildRequestBody({
      distro: 'openwrt',
      device: DEVICE,
      packages: ['luci', '-ppp'],
      config: { ...EMPTY_CONFIG, hostname: ' myrouter ', rootPassword: 'secret ' },
    })
    expect(full).toEqual({
      distro: 'openwrt',
      version: '25.12.5',
      target: 'ramips/mt7621',
      profileId: 'acme_router-1',
      packages: ['luci', '-ppp'],
      config: { hostname: 'myrouter', rootPassword: 'secret ' },
    })
  })

  it('buildRequestBody returns null when the distro has no build for the device', () => {
    expect(buildRequestBody({ distro: 'immortalwrt', device: DEVICE, packages: [], config: EMPTY_CONFIG })).toBeNull()
    expect(buildRequestBody({ distro: 'openwrt', device: null, packages: [], config: EMPTY_CONFIG })).toBeNull()
  })
})

describe('package filtering and formatting', () => {
  const categories = [
    {
      name: 'LuCI Apps',
      packages: [
        { name: 'luci-app-sqm', version: '1.0', section: 'luci', sizeBytes: 2048, description: 'SQM queue management', feed: 'luci' },
        { name: 'luci-app-firewall', version: '1.0', section: 'luci', sizeBytes: 4096, description: 'Firewall UI', feed: 'luci' },
      ],
    },
    {
      name: 'Network',
      packages: [{ name: 'sqm-scripts', version: '1.6', section: 'net', sizeBytes: 1024, description: 'Traffic shaping scripts', feed: 'packages' }],
    },
  ]

  it('filterPackages matches name or description across categories, name hits first', () => {
    expect(filterPackages(categories, 'sqm').map((p) => p.name)).toEqual(['sqm-scripts', 'luci-app-sqm'])
    expect(filterPackages(categories, 'firewall ui').map((p) => p.name)).toEqual(['luci-app-firewall'])
    expect(filterPackages(categories, '')).toEqual([])
  })

  it('formatSize renders B / KB / MB and hides zero', () => {
    expect(formatSize(0)).toBe('')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2 KB')
    expect(formatSize(1572864)).toBe('1.5 MB')
  })

  it('relativeUntil counts down hours and minutes', () => {
    const now = new Date('2026-07-07T10:00:00Z')
    expect(relativeUntil('2026-07-07T13:12:00Z', now)).toBe('in 3h 12m')
    expect(relativeUntil('2026-07-07T10:47:00Z', now)).toBe('in 47m')
    expect(relativeUntil('2026-07-07T09:00:00Z', now)).toBe('now')
  })
})

describe('buildRequestBody community + language', () => {
  const device = {
    slug: 'x',
    vendor: 'V',
    model: 'M',
    variant: null,
    builds: [{ distro: 'openwrt' as const, version: '25.12.5', target: 'x86/64', profileId: 'generic' }],
  }
  const sel = { distro: 'openwrt' as const, device, packages: [], config: EMPTY_CONFIG }

  it('includes communityPackages when non-empty', () => {
    const body = buildRequestBody({ ...sel, communityPackages: ['openclash'], uiLanguage: 'en' })
    expect(body?.communityPackages).toEqual(['openclash'])
  })

  it('omits communityPackages when empty and omits uiLanguage when en', () => {
    const body = buildRequestBody({ ...sel, communityPackages: [], uiLanguage: 'en' })
    expect(body?.communityPackages).toBeUndefined()
    expect(body?.uiLanguage).toBeUndefined()
  })

  it('includes uiLanguage when not en', () => {
    const body = buildRequestBody({ ...sel, communityPackages: [], uiLanguage: 'zh-cn' })
    expect(body?.uiLanguage).toBe('zh-cn')
  })
})

describe('community toggle', () => {
  it('adds then removes an id', () => {
    expect(toggleId([], 'openclash')).toEqual(['openclash'])
    expect(toggleId(['openclash'], 'openclash')).toEqual([])
  })
})

describe('render smoke', () => {
  it('DistroStep renders both distro cards with versions as radio inputs', () => {
    const html = renderToStaticMarkup(
      createElement(DistroStep, { distros: DISTROS, value: 'openwrt', onChange: () => {} }),
    )
    expect(html).toContain('OpenWrt')
    expect(html).toContain('ImmortalWrt')
    expect(html).toContain('25.12.5')
    expect(html).toContain('type="radio"')
  })

  it('CommunityStep renders the warning-styled add-ons region unselected, plus a neutral themes section', () => {
    const html = renderToStaticMarkup(
      createElement(CommunityStep, {
        components: [
          { id: 'openclash', label: 'OpenClash', category: 'proxy', note: 'Needs internet on first run.' },
          { id: 'argon-theme', label: 'Argon theme', category: 'theme', note: null },
        ],
        selected: [],
        onToggle: () => {},
        languages: ['en', 'zh-cn'],
        uiLanguage: 'en',
        onLanguage: () => {},
      }),
    )
    expect(html).toContain('Community add-ons')
    expect(html).toContain('Community-maintained add-ons — you are responsible for how you use them.')
    expect(html).toContain('Popular themes')
    expect(html).toContain('English (default)')
    expect(html).not.toContain('checked=""') // nothing pre-selected
  })
})
