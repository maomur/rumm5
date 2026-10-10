import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const json = readFileSync('shots/play.json', 'utf8')
const { tile, meldId } = JSON.parse(readFileSync('shots/play-info.json', 'utf8'))
const browser = await chromium.launch()
const errors = []
for (const [w, h] of [[390, 844], [320, 568], [844, 390]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  await ctx.addInitScript((j) => { localStorage.setItem('rumm5.save.v1', j); localStorage.setItem('rumm5.prefs.v1', JSON.stringify({ muted: true })) }, json)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:4173/'); await page.waitForTimeout(1900)
  await page.getByText('Continuar partida').click(); await page.waitForTimeout(900)
  await page.screenshot({ path: `shots/bar-normal-${w}.png` })
  await page.locator(`#rack [data-tile="${tile}"]`).click(); await page.waitForTimeout(300)
  await page.screenshot({ path: `shots/bar-select-${w}.png` })
  await page.evaluate((id) => window.__game.getState().moveSelectedTo({ kind: 'meld', meldId: id }), meldId); await page.waitForTimeout(500)
  await page.screenshot({ path: `shots/bar-played-${w}.png` })
  const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  // ¿se sale algún botón de la barra?
  const clipped = await page.locator('button:visible').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1 }).map((e) => e.textContent))
  console.log(w, 'scroll:', over, 'botones fuera:', clipped)
  if (w === 390) {
    // terminar y ver el parpadeo cuando juega un bot
    await page.locator('button:visible', { hasText: 'Terminar' }).click()
    const t0 = Date.now(); let seen = null
    for (let i = 0; i < 120 && !seen; i++) {
      await page.waitForTimeout(200)
      const r = await page.evaluate(() => { const s = window.__game.getState(); return { recent: s.recentMelds, cur: s.game.current } })
      if (r.recent.length && r.cur !== 0) seen = { at: Date.now() - t0, ...r }
      if (r.recent.length && r.cur === 0 && Date.now() - t0 > 3000) seen = { at: Date.now() - t0, ...r }
    }
    console.log('parpadeo visto', seen)
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'shots/recent-390.png' })
    const start = Date.now()
    while (await page.evaluate(() => window.__game.getState().recentMelds.length) && Date.now() - start < 8000) await page.waitForTimeout(200)
    console.log('dura aprox', ((Date.now() - start) / 1000 + 0.5).toFixed(1), 's desde la captura')
  }
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'sin errores')
