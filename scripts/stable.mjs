import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const json = readFileSync('shots/play.json', 'utf8')
const browser = await chromium.launch()
for (const [w, h] of [[390, 844], [320, 568], [844, 390]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  await ctx.addInitScript((j) => { localStorage.setItem('rumm5.save.v1', j); localStorage.setItem('rumm5.prefs.v1', JSON.stringify({ muted: true })) }, json)
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/'); await page.waitForTimeout(1900)
  await page.getByText('Continuar partida').click(); await page.waitForTimeout(1000)
  const pos = () => page.locator('.meld [data-tile]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${e.dataset.tile}:${Math.round(r.left)},${Math.round(r.top)}` }).join(' '))
  const before = await pos()
  await page.locator('#rack [data-tile]').first().click(); await page.waitForTimeout(500)
  const after = await pos()
  console.log(`${w}x${h}`, before === after ? 'mesa quieta ✓' : 'SE MUEVE ✗')
  await ctx.close()
}
await browser.close()
