import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const over = JSON.parse(readFileSync('shots/remote-over.json', 'utf8'))
const next = JSON.parse(readFileSync('shots/remote-next.json', 'utf8'))
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })).newPage()
await page.addInitScript(() => localStorage.setItem('rumm5.prefs.v1', JSON.stringify({ muted: true })))
await page.goto('http://localhost:4173/'); await page.waitForTimeout(1800)
const seat = next.game.players[next.game.current].id  // el que empieza la revancha, y NO es el anfitrión
const r = await page.evaluate(async ({ over, next, seat }) => {
  const g = window.__game
  g.getState().startOnline(seat, () => {})
  g.getState().applyRemote(over.game, over.events, null)
  await new Promise((res) => setTimeout(res, 2500))
  const mid = { showRoundOver: g.getState().showRoundOver }
  g.getState().applyRemote(next.game, next.events, null)   // el anfitrión pulsa "Siguiente ronda"
  await new Promise((res) => setTimeout(res, 2500))
  const s = g.getState()
  return { seat, host: next.game.players[0].id, mid, busy: s.busy, queue: s.queue.length, showRoundOver: s.showRoundOver, myTurn: s.game.players[s.game.current].id === seat }
}, { over, next, seat })
console.log(r)
await browser.close()
