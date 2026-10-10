import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const sizes = (process.env.SIZES ?? '390x844,844x390,568x320,320x568').split(',').map((s) => s.split('x').map(Number))
const scen = (process.env.SCEN ?? 'home,start,select,mid,over').split(',')
const browser = await chromium.launch()
const errors = []
for (const [w, h] of sizes) {
  for (const sc of scen) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
    const file = sc === 'select' ? 'start' : sc
    if (sc !== 'home' && sc !== 'setup') {
      const json = readFileSync(`shots/${file}.json`, 'utf8')
      await ctx.addInitScript((j) => { localStorage.setItem('rumm5.save.v1', j); localStorage.setItem('rumm5.prefs.v1', JSON.stringify({ muted: true })) }, json)
    }
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`${sc} ${w}x${h}: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${sc} ${w}x${h}: ${m.text()}`) })
    await page.goto('http://localhost:4173/')
    await page.waitForTimeout(1900)
    if (sc === 'setup') await page.getByText('Nueva partida').click()
    if (sc !== 'home' && sc !== 'setup') await page.getByText('Continuar partida').click()
    await page.waitForTimeout(1500)
    if (sc === 'select') {
      const tiles = page.locator('#rack [data-tile]')
      for (const i of [0, 1, 2]) await tiles.nth(i).click()
      await page.waitForTimeout(400)
    }
    const sw = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    if (sw) errors.push(`${sc} ${w}x${h}: SCROLL HORIZONTAL`)
    await page.screenshot({ path: `shots/${sc}-${w}x${h}.png` })
    await ctx.close()
  }
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'sin errores')
