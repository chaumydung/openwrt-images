// E2E：设备页匿名下载轨道（上游 downloads.openwrt.org 链接 + sha256）与
// "Customize firmware" CTA → 构建器预填（Step 3 起步）。对应 TC-E2E-003、TC-E2E-004。
// 全程免登录、不提交构建（不消耗配额）。
import { expect, test } from '@playwright/test'

const SLUG = 'gl-inet-gl-mt3000'

test('TC-E2E-003 匿名下载轨道：设备页上游下载链接指向 downloads.openwrt.org', async ({ page }) => {
  await page.goto(`/device/${SLUG}`)

  await expect(page.getByRole('heading', { level: 1 })).toContainText('GL.iNet GL-MT3000')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Firmware')

  // Download images 区块内的镜像链接必须直指官方上游（匿名轨道，PRD §3.1/§4.2）
  const downloadSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Download images' }) })
  const imageLinks = downloadSection.locator('a[href^="https://downloads.openwrt.org/"]')
  expect(await imageLinks.count()).toBeGreaterThan(0)

  // 每个镜像行携带 sha256（截断展示 + 复制按钮）
  await expect(downloadSection.getByRole('button', { name: /Copy sha256 checksum/ }).first()).toBeVisible()
})

test('TC-E2E-004 设备页 "Customize firmware" CTA 跳转构建器并预填设备（Step 3 起步）', async ({ page }) => {
  await page.goto(`/device/${SLUG}`)

  await page.getByRole('link', { name: 'Customize firmware for this device' }).click()
  await expect(page).toHaveURL(new RegExp(`/\\?device=${SLUG}#builder$`))

  // 预填自动完成步骤 1-2，落在 Step 3（Packages）
  await expect(page.getByText('Step 3 of 4')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Packages', exact: true })).toBeVisible()

  // 步骤 1-2 已完成 → Step 4 在步骤条中可达
  await expect(page.getByRole('button', { name: 'Configure & build' })).toBeEnabled()
})
