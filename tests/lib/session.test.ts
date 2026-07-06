// Tests for getSessionUser: mock-mode user + idempotent upsert, MOCK_LOGGED_OUT override,
// and the real-mode path through a stubbed auth().
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('getSessionUser (mock mode)', () => {
  it('returns the fixed mock user and upserts it into the DB', async () => {
    const user = await getSessionUser()
    expect(user).toEqual({ id: 'mock-user-1', login: 'mockdev' })
    const stored = await getDb().users.get('mock-user-1')
    expect(stored?.githubLogin).toBe('mockdev')
    expect(mockedAuth).not.toHaveBeenCalled()
  })

  it('upserts idempotently across repeated calls (createdAt preserved)', async () => {
    await getSessionUser()
    const first = await getDb().users.get('mock-user-1')
    await getSessionUser()
    const second = await getDb().users.get('mock-user-1')
    expect(second?.createdAt).toEqual(first?.createdAt)
  })

  it('returns null when MOCK_LOGGED_OUT=1', async () => {
    vi.stubEnv('MOCK_LOGGED_OUT', '1')
    expect(await getSessionUser()).toBeNull()
    expect(mockedAuth).not.toHaveBeenCalled()
  })

  it('stays in mock mode when APP_MODE=real but AUTH_GITHUB_ID is missing', async () => {
    vi.stubEnv('APP_MODE', 'real')
    vi.stubEnv('AUTH_GITHUB_ID', '')
    expect(await getSessionUser()).toEqual({ id: 'mock-user-1', login: 'mockdev' })
    expect(mockedAuth).not.toHaveBeenCalled()
  })
})

describe('getSessionUser (real mode)', () => {
  it('maps the Auth.js session to { id, login }', async () => {
    vi.stubEnv('APP_MODE', 'real')
    vi.stubEnv('AUTH_GITHUB_ID', 'test-client-id')
    mockedAuth.mockResolvedValue({ user: { id: '42', login: 'octocat' } })
    expect(await getSessionUser()).toEqual({ id: '42', login: 'octocat' })
    expect(mockedAuth).toHaveBeenCalledTimes(1)
  })

  it('returns null when there is no session', async () => {
    vi.stubEnv('APP_MODE', 'real')
    vi.stubEnv('AUTH_GITHUB_ID', 'test-client-id')
    mockedAuth.mockResolvedValue(null)
    expect(await getSessionUser()).toBeNull()
  })
})
