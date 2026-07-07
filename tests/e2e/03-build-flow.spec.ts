// E2E：完整定制构建流（四步 → 提交 → 轮询至 success → 产物卡）与配额拦截（第 2 次 → 429 配额卡）。
// 对应 TC-E2E-005、TC-E2E-006。serial：配额用例依赖前一条已消耗当日唯一配额（进程内存态），
// 且本文件必须在 01/02 之后执行（文件名前缀排序 + workers=1 保证）。重跑需重启 server。
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

/** 走完构建器前三步（OpenWrt 默认 → 搜索选 GL-MT3000 → 跳过包），停在 Step 4。 */
async function walkToConfigStep(page: Page, { assertGating = false } = {}) {
  await page.goto('/')

  // Step 1：发行版保持默认 OpenWrt
  await expect(page.getByText('Step 1 of 4')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Step 2：搜索并选择设备
  await expect(page.getByText('Step 2 of 4')).toBeVisible()
  if (assertGating) {
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  }
  // 首页 hero 搜索框与构建器设备搜索框共用同一 aria-label，限定在构建器区块内
  const search = page.locator('#builder').getByRole('combobox', { name: 'Search your device model' })
  await search.fill('GL-MT3000')
  await page.getByRole('option', { name: /GL\.iNet GL-MT3000/ }).first().click()
  await expect(page.getByText('target mediatek/filogic')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Step 3：包为可选，直接继续（不依赖上游包索引加载）
  await expect(page.getByText('Step 3 of 4')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Step 4：配置全部留空（全字段可选）
  await expect(page.getByText('Step 4 of 4')).toBeVisible()
}

test('TC-E2E-005 完整定制构建流：四步构建器 → 提交 → 轮询至成功 → 产物卡', async ({ page }) => {
  await walkToConfigStep(page, { assertGating: true })

  await page.getByRole('button', { name: 'Build firmware' }).click()
  await page.waitForURL(/\/builds\/[^/]+$/, { timeout: 20_000 })

  // Mock 执行器按 GET 轮询推进（queued×2 → building×3 → success），3s/次 ≈ 20s 内到终态
  await expect(page.getByText('Success', { exact: true })).toBeVisible({ timeout: 45_000 })

  // 产物卡：下载按钮 + 64 位 sha256 + 24 小时保留提示（PRD §3.2）
  await expect(page.getByRole('heading', { name: 'Your firmware is ready' })).toBeVisible()
  const download = page.getByRole('link', { name: /^Download .+sysupgrade\.bin$/ })
  await expect(download).toBeVisible()
  expect(await download.getAttribute('href')).toMatch(/^https:\/\//)
  await expect(page.locator('code').filter({ hasText: /^[a-f0-9]{64}$/ }).first()).toBeVisible()
  await expect(page.getByText('Available for 24 hours')).toBeVisible()

  // 构建日志流含 ImageBuilder 关键行
  await expect(page.locator('pre').first()).toContainText('make image PROFILE="glinet_gl-mt3000"')
})

test('TC-E2E-006 配额拦截：同一会话第 2 次构建被 429 拦截并显示重置时间', async ({ page }) => {
  await walkToConfigStep(page)

  await page.getByRole('button', { name: 'Build firmware' }).click()

  // 429 → 页面不跳转，构建器内出现配额卡与重置时间文案
  const quotaCard = page.getByRole('alert').filter({ hasText: 'Daily build limit reached' })
  await expect(quotaCard).toBeVisible({ timeout: 15_000 })
  await expect(quotaCard).toContainText(/Your quota resets (in \d+h \d+m|in \d+m|now)/)
  await expect(page).not.toHaveURL(/\/builds\//)
})
