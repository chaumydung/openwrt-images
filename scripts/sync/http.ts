// HTTP helpers for the sync pipeline: retry with backoff, timeout, 404 as a typed error.
export class HttpNotFoundError extends Error {
  constructor(url: string) {
    super(`404 Not Found: ${url}`)
  }
}

type Opts = { retries?: number; retryDelayMs?: number; timeoutMs?: number }

async function fetchResponse(url: string, opts: Opts = {}): Promise<Response> {
  const { retries = 3, retryDelayMs = 1000, timeoutMs = 15000 } = opts
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      if (res.status === 404) throw new HttpNotFoundError(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
      return res
    } catch (err) {
      if (err instanceof HttpNotFoundError) throw err
      lastError = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, retryDelayMs * 2 ** attempt))
    }
  }
  throw lastError
}

export async function fetchText(url: string, opts?: Opts): Promise<string> {
  return (await fetchResponse(url, opts)).text()
}

export async function fetchJson<T>(url: string, opts?: Opts): Promise<T> {
  return (await fetchResponse(url, opts)).json() as Promise<T>
}
