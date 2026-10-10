import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const json = readFileSync('shots/play.json', 'utf8')
const { tile, meldId } = JSON.parse(readFileSync('shots/play-info.json', 'utf8'))
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
await ctx.addInitScript((j) => { localStorage.setItem('rumm5.save.v1', j); localStorage.setItem('rumm5.prefs.v1', JSON.stringify({ muted: true })) }, json)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
const st = () => page.evaluate(() => { const s = window.__game.getState(); return { cur: s.game.current, phase: s.game.phase, table: s.game.table.length, draftTable: s.game.draft.table.map(m=>m.tiles.length), rack: s.game.players[0].rack.length, toast: s.toast?.text ?? null, busy: s.busy, invalid: s.invalidMelds } })
await page.goto('http://localhost:4173/')
await page.waitForTimeout(1900)
await page.getByText('Continuar partida').click()
await page.waitForTimeout(1200)
console.log('inicio', await st())

// 1) jugada inválida: una ficha sola en jugada nueva → Terminar → error
const anyRack = page.locator('#rack [data-tile]').first()
await anyRack.click()
await page.getByText('+ Nueva jugada').click()
await page.waitForTimeout(500)
await page.locator('button:visible', { hasText: 'Terminar' }).click()
await page.waitForTimeout(300)
console.log('tras terminar inválido', await st())
await page.screenshot({ path: 'shots/flow-invalid.png' })
await page.locator('button:visible', { hasText: 'Recoger' }).click()
await page.waitForTimeout(500)
console.log('tras recoger', await st())

// 2) jugada válida: la ficha que alarga la escalera
await page.locator(`#rack [data-tile="${tile}"]`).click()
await page.waitForTimeout(200)
await page.screenshot({ path: 'shots/flow-selected.png' })
await page.locator('.meld .tile.ghost').nth(0).waitFor()
// el "+" de la jugada correcta: buscamos la jugada que contiene la escalera
const melds = page.locator('.meld')
const n = await melds.count()
let clicked = false
for (let i = 0; i < n && !clicked; i++) {
  const ids = await melds.nth(i).locator('[data-tile]').evaluateAll((els) => els.map((e) => e.dataset.tile))
  const s = await page.evaluate((mid) => window.__game.getState().game.draft.table.find((m) => m.id === mid)?.tiles.map(String), meldId)
  if (s && s.every((x) => ids.includes(x))) { await melds.nth(i).locator('.tile.ghost').click(); clicked = true }
}
await page.waitForTimeout(600)
console.log('tras colocar', await st())
await page.screenshot({ path: 'shots/flow-placed.png' })
await page.locator('button:visible', { hasText: 'Terminar' }).click()
await page.waitForTimeout(500)
console.log('tras terminar', await st())
// esperamos a los 3 bots
for (let i = 0; i < 30; i++) { await page.waitForTimeout(1000); const s = await st(); if (s.cur === 0 && !s.busy) break }
console.log('vuelve mi turno', await st())
await page.screenshot({ path: 'shots/flow-back.png' })
// robar
await page.locator('button:visible', { hasText: /Robar|Pasar/ }).click()
await page.waitForTimeout(800)
console.log('tras robar', await st())
await browser.close()
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'sin errores de consola')
