import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const json = readFileSync('shots/play.json', 'utf8')
const { tile } = JSON.parse(readFileSync('shots/play-info.json', 'utf8'))
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
await ctx.addInitScript((j) => { localStorage.setItem('rumm5.save.v1', j); localStorage.setItem('rumm5.prefs.v1', JSON.stringify({ muted: true })) }, json)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:4173/'); await page.waitForTimeout(1900)
await page.getByText('Continuar partida').click(); await page.waitForTimeout(1000)
await page.locator(`#rack [data-tile="${tile}"]`).click()
await page.waitForTimeout(300)
await page.screenshot({ path: 'shots/newmeld-390.png' })
await ctx.close()
// 320 de ancho
const ctx2 = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
await ctx2.addInitScript((j) => { localStorage.setItem('rumm5.save.v1', j); localStorage.setItem('rumm5.prefs.v1', JSON.stringify({ muted: true })) }, json)
const p2 = await ctx2.newPage()
await p2.goto('http://localhost:4173/'); await p2.waitForTimeout(1900)
await p2.getByText('Continuar partida').click(); await p2.waitForTimeout(1000)
const r = p2.locator('#rack [data-tile]')
await r.nth(0).click(); await p2.locator('button:visible', { hasText: 'Jugada' }).click(); await p2.waitForTimeout(400)
await r.nth(0).click(); await p2.waitForTimeout(300)
await p2.screenshot({ path: 'shots/newmeld-320.png' })
// ver a los bots: robo y cronometro los pasos
await p2.locator('button:visible', { hasText: 'Recoger' }).click(); await p2.waitForTimeout(400)
await p2.locator('button:visible', { hasText: /Robar|Pasar/ }).click()
const t0 = Date.now(); const log = []
let last = ''
for (let i = 0; i < 160; i++) {
  await p2.waitForTimeout(250)
  const s = await p2.evaluate(() => { const g = window.__game.getState().game; return `${g.current}|${g.draft.table.map(m=>m.tiles.length).join(',')}` })
  if (s !== last) { log.push(`${((Date.now()-t0)/1000).toFixed(1)}s ${s}`); last = s }
  if (s.startsWith('0|') && i > 8) break
}
console.log(log.join('\n'))
await browser.close()
console.log(errors.length ? errors.join('\n') : 'sin errores')
