# OpenWrt / ImmortalWrt Online Firmware Builder

Build custom OpenWrt and ImmortalWrt firmware images in your browser — pick a device,
choose packages, set a few network basics, and download a ready-to-flash image, without
setting up the ImageBuilder toolchain locally.

> Not affiliated with the OpenWrt or ImmortalWrt projects. "OpenWrt" and "ImmortalWrt" are
> trademarks of their respective owners; this project uses the names descriptively only.

## What it does

- **Default downloads** — every device page links straight to the **official** upstream
  mirrors (`downloads.openwrt.org` / `downloads.immortalwrt.org`), free and unlimited, no
  account. This project never re-hosts default images.
- **Custom builds** — a four-step wizard (distribution → device → packages → config) runs
  the official ImageBuilder and returns a flashable image in minutes. Only custom-built
  artifacts are hosted by this service.
- **Device pages** — one page per device (`/device/<slug>`) with real specs, the firmware
  matrix, official download links, default packages, and a customize-firmware entry point.
- **Package selection** — a curated official quick-pick list, free-form package input, and
  a vetted catalog of popular community add-ons (PassWall, OpenClash, HomeProxy, SmartDNS,
  …) that are **off by default** and installed at build time on opt-in, plus an optional
  UI language.

## How it works

```
Browser (Next.js site)                GitHub Actions (this repo)         GitHub Releases
──────────────────────                ──────────────────────────         ───────────────
pick device + packages                                                   build-<id> release
        │  POST /api/builds                                              (images + meta.json,
        ▼                                                                 24h retention)
website backend ── workflow_dispatch ─▶ build-firmware.yml                       ▲
        ▲                                 runs ImageBuilder ──────────── publishes ┘
        └──── workflow_run webhook ◀────── + community add-ons
        │
        ▼
status + download link
```

- **Website** — Next.js App Router app (SSR-first for crawlability). Anonymous browsing and
  default downloads need no account; the login wall triggers only when you click **Build**.
- **Build executor** — an abstract interface with two implementations: a **mock** executor
  for local development (no real builds) and a **GitHub Actions** executor for production
  (`workflow_dispatch` → ImageBuilder → publish a per-build GitHub Release → `workflow_run`
  webhook reports status). Build inputs and logs are public on the build repo — an accepted
  design decision; a strict config-field whitelist is the safety boundary.
- **Artifact storage** — custom-build images are published as assets on a per-build GitHub
  Release (`build-<id>`), kept for 24 hours and pruned by a scheduled workflow. No object
  store required.
- **Data** — device and package catalogs are generated from the official download servers
  (never hand-maintained); community add-on versions are refreshed from their GitHub
  releases. See `pnpm sync`.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · pnpm · Vitest +
Playwright · Neon Postgres (Drizzle) · Auth.js (GitHub OAuth) · GitHub Actions + OpenWrt
ImageBuilder.

## Quick start (mock mode — zero config)

Requires Node 20+ and pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

In the default **mock** mode (`APP_MODE` unset) the executor is simulated, login is skipped
(a built-in dev user), and no database or external service is needed — the full build flow
works end-to-end against the mock executor.

```bash
pnpm test           # unit + component tests (Vitest)
pnpm test:e2e       # end-to-end flow (Playwright)
pnpm lint
pnpm build          # production build
```

## Refreshing catalog data

```bash
pnpm sync           # regenerate data/catalog/ from the official downloads servers,
                    # and refresh data/packages/community.json from add-on GitHub releases
```

## Deploying (production / real mode)

The website runs on any Next.js-capable host — **Vercel** (free Hobby tier, no card) is the
default; Cloudflare Pages/Workers, Netlify, or a Node host also work. GitHub Pages cannot
run it (it is a dynamic app with API routes, SSR/ISR, auth, and a database — not a static
site).

Setting `APP_MODE=real` switches the executor, auth, and database to their real backends
together. You will need:

| Variable | Purpose |
|----------|---------|
| `APP_MODE=real` | Enable the real executor / auth / DB |
| `BUILD_REPO` | `owner/repo` of the public build repo (this repo) |
| `BUILD_GITHUB_TOKEN` | Fine-grained PAT with **Actions: read and write** on the build repo |
| `BUILD_WEBHOOK_SECRET` | Shared secret for the `workflow_run` webhook |
| `DATABASE_URL` | Neon Postgres connection string (`pnpm db:migrate` to set up) |
| `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Auth.js + a GitHub OAuth App |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL |
| `NEXT_PUBLIC_GTM_ID` | (optional) Google Tag Manager, loaded in production only |

On the **build repo**: enable Actions, and add a webhook (`workflow_run` event) pointing at
`https://<your-site>/api/webhooks/build` with `BUILD_WEBHOOK_SECRET`. Artifact publishing
and pruning use the workflow's built-in `GITHUB_TOKEN` — no storage account or secrets.

See `.env.example` for the full key set and `docs/PRD.md` for the product spec.

## Project structure

```
src/app/            Next.js routes (homepage builder, /device/[slug], /builds/[id], /api/*)
src/components/      UI components (builder wizard, device search, …)
src/lib/            catalog, search, executor (mock + github), db, quota, auth, packages
scripts/sync/       catalog + community-add-on data sync (pnpm sync)
scripts/build/      build-time community-add-on resolver
.github/workflows/  build-firmware.yml (executor) + prune-builds.yml (24h retention)
data/               generated catalogs + curated package data
docs/               PRD, SEO/design specs, test & security docs
tests/              Vitest unit/component + Playwright e2e
```

## Contributing

Issues and pull requests are welcome. Before opening a PR, please run `pnpm lint`,
`pnpm test`, and `pnpm build` and keep them green. Device and package data lives in
`data/` and is generated by `pnpm sync` — don't edit it by hand.

## License

[MIT](./LICENSE) © 2026 chaumydung.

Firmware images are assembled from unmodified, official OpenWrt/ImmortalWrt binary packages;
their source is available from the upstream projects for GPL compliance. This project's own
code is MIT-licensed.
