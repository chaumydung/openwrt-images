// Adapter-agnostic entity types and the Db repository interface shared by all implementations.

export type BuildStatus = 'queued' | 'building' | 'success' | 'failed' | 'timeout'

// Whitelisted base-config fields only (PRD §3.3) — never extend with proxy/DDNS/PPPoE/VPN/port-forward fields.
export type BuildConfig = {
  hostname?: string
  timezone?: string
  lanIp?: string
  rootPassword?: string
  wifiSsid?: string
  wifiPassword?: string
}

export type BuildSpec = {
  distro: 'openwrt' | 'immortalwrt'
  version: string
  target: string
  profile: string
  packages: string[]
  config: BuildConfig
}

export type User = {
  id: string
  githubLogin: string
  createdAt: Date
}

export type Build = {
  id: string
  userId: string
  status: BuildStatus
  spec: BuildSpec
  externalId: string | null
  queuePosition: number | null
  logUrl: string | null
  artifactUrl: string | null
  artifactExpiresAt: Date | null
  failureReason: string | null
  quotaRefunded: boolean
  createdAt: Date
  updatedAt: Date
}

export type BuildUpdate = Partial<
  Pick<
    Build,
    | 'status'
    | 'externalId'
    | 'queuePosition'
    | 'logUrl'
    | 'artifactUrl'
    | 'artifactExpiresAt'
    | 'failureReason'
    | 'quotaRefunded'
  >
>

export type Feedback = {
  id: number
  name: string
  email: string
  message: string
  createdAt: Date
}

// Repository adapter interface — the only database contract business code may depend on.
// utcDay is always a 'YYYY-MM-DD' string in UTC.
export interface Db {
  users: {
    upsert(input: { id: string; githubLogin: string }): Promise<User>
    get(id: string): Promise<User | null>
  }
  builds: {
    create(input: { userId: string; spec: BuildSpec }): Promise<Build>
    get(id: string): Promise<Build | null>
    /** Looks a build up by its executor correlation id (webhook callbacks). */
    getByExternalId(externalId: string): Promise<Build | null>
    updateStatus(id: string, patch: BuildUpdate): Promise<Build | null>
    listActiveCount(): Promise<number>
    activeByUser(userId: string): Promise<Build[]>
  }
  quota: {
    getUsedToday(userId: string, utcDay: string): Promise<number>
    /** Atomically increments (userId, utcDay) usage and returns the new count. */
    increment(userId: string, utcDay: string): Promise<number>
    /** Decrements usage but never below zero; returns the new count. */
    decrementIfPositive(userId: string, utcDay: string): Promise<number>
  }
  feedback: {
    create(input: { name: string; email: string; message: string }): Promise<Feedback>
  }
}
