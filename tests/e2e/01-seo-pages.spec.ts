// E2E（request 层，不执行 JS）：SSR 可抓取性——首页原始 HTML 携带 H1/FAQ/JSON-LD，
// /builds/[id] 原始 HTML 携带 noindex robots meta。对应 TC-E2E-001、TC-E2E-002。
import { expect, test } from '@playwright/test'

test('TC-E2E-001 首页原始 HTML 含 H1、FAQ 与 JSON-LD（View Source 可抓取）', async ({ request }) => {
  const res = await request.get('/')
  expect(res.status()).toBe(200)
  const html = await res.text()

  // H1 与 title / meta description 必须在首屏 HTML 中（非 JS 注入）
  expect(html).toMatch(/<h1[^>]*>OpenWrt Online Builder — Custom Firmware Images<\/h1>/)
  expect(html).toContain('<title>OpenWrt Online Builder — Custom Firmware Images</title>')
  expect(html).toMatch(/<meta name="description" content="[^"]+"/)

  // FAQ 区块服务端渲染（标题 + 至少一条问题）
  expect(html).toContain('OpenWrt online builder FAQ')
  expect(html).toContain('Is the OpenWrt online builder free?')

  // 内联 JSON-LD：SoftwareApplication + FAQPage
  expect(html).toContain('application/ld+json')
  expect(html).toContain('"SoftwareApplication"')
  expect(html).toContain('"FAQPage"')
})

test('TC-E2E-002 /builds/[id] 原始 HTML 含 noindex robots meta', async ({ request }) => {
  const res = await request.get('/builds/e2e-noindex-probe')
  expect(res.status()).toBe(200)
  const html = await res.text()

  // noindex, nofollow 由页面 metadata 静态声明，与 build 是否存在无关
  expect(html).toMatch(/<meta name="robots" content="noindex,\s*nofollow"/)
  // noindex 页面不得携带 canonical（docs/SEO.md）
  expect(html).not.toContain('rel="canonical"')
})
