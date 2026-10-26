import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173'
const output = resolve(process.env.SCREENSHOT_DIR ?? '../screenshots')
const views = [
  { path: '/', name: 'decision', ready: 'Decision cutoff:' },
  { path: '/revisions', name: 'revisions', ready: 'How the forecast moved' },
  {
    path: '/accuracy',
    name: 'accuracy',
    ready: 'Illustrative bias adjustment',
  },
  { path: '/method', name: 'method', ready: 'Limits of this analysis' },
]
const sizes = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]

await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (const size of sizes) {
    const page = await browser.newPage({
      viewport: size,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    })
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text())
    })
    for (const view of views) {
      await page.goto(new URL(view.path, base).href, {
        waitUntil: 'networkidle',
      })
      await page.getByText(view.ready, { exact: false }).first().waitFor()
      if (await page.locator('[role="alert"]').count())
        throw new Error(`${view.name}: alert visible`)
      if (pageErrors.length)
        throw new Error(`${view.name}: ${pageErrors.join('; ')}`)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      )
      if (overflow)
        throw new Error(
          `${view.name}: horizontal page overflow at ${size.width}px`,
        )
      const file = resolve(output, `${view.name}-${size.name}.png`)
      await page.screenshot({
        path: file,
        fullPage: true,
        animations: 'disabled',
      })
      console.log(`${view.name} ${size.name}: ${file}`)
    }
    await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' })
    await page.getByLabel('Delivery day').selectOption('2026-01-02')
    await page.getByLabel('Decision cutoff').selectOption('11')
    await page
      .getByText('Decision cutoff: 01 Jan 11:00 GMT', { exact: false })
      .waitFor()
    await page.getByRole('button', { name: 'Table' }).click()
    const hourlyRows = await page
      .getByRole('table', { name: /Decision-time hourly forecast/ })
      .locator('tbody tr')
      .count()
    if (hourlyRows !== 24)
      throw new Error(
        `Expected 24 hourly rows after changing controls, got ${hourlyRows}`,
      )
    console.log(`${size.name} controls: day, cutoff and 24-row table verified`)
    await page.close()
  }

  const skeletonPage = await browser.newPage({
    viewport: sizes[0],
    reducedMotion: 'reduce',
  })
  const skeletonErrors = []
  skeletonPage.on('pageerror', (error) => skeletonErrors.push(error.message))
  await skeletonPage.route('**/api/meta', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 8000))
    await route.continue()
  })
  await skeletonPage.goto(new URL('/', base).href, {
    waitUntil: 'domcontentloaded',
  })
  await skeletonPage.locator('.skeleton-banner').waitFor()
  if (skeletonErrors.length)
    throw new Error(`skeleton: ${skeletonErrors.join('; ')}`)
  if (
    await skeletonPage.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    )
  )
    throw new Error('skeleton: horizontal page overflow')
  const skeletonFile = resolve(output, 'decision-skeleton-desktop.png')
  await skeletonPage.screenshot({
    path: skeletonFile,
    fullPage: true,
    animations: 'disabled',
  })
  console.log(`decision skeleton desktop: ${skeletonFile}`)
  await skeletonPage.close()
} finally {
  await browser.close()
}
