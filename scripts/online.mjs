import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'
const URL = 'http://localhost:5173/'
const browser = await chromium.launch()
const errors = []
async function player(name, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  await ctx.addInitScript((n) => localStorage.setItem('rumm5.prefs.v1', JSON.stringify({ muted: true, name: n })), name)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`) })
  await page.goto(url)
  await page.waitForTimeout(1800)
  return page
}
const st = (p) => p.evaluate(() => { const s = window.__game.getState(); const g = s.game; return g ? { screen: s.screen, mode: s.mode, me: s.mySeat, cur: g.players[g.current].id, phase: g.phase, rack: g.players.map(x=>x.rack.length), pool: g.pool.length, table: g.table.length, draft: g.draft.table.length } : { screen: s.screen } })
const A = await player('Mauri', URL)
await A.getByText('Jugar con amigos').click()
await A.getByText('Crear sala').click()
await A.waitForTimeout(1500)
const code = await A.evaluate(() => new URLSearchParams(location.search).get('sala'))
console.log('sala', code)
const B = await player('Ana', URL + '?sala=' + code)
await B.waitForTimeout(1500)
await A.getByText('+ 🤖 Medio').click()
await A.waitForTimeout(600)
await A.screenshot({ path: 'shots/online-lobby.png' })
await A.getByText('Empezar partida').click()
await A.waitForTimeout(2500)
console.log('A', await st(A)); console.log('B', await st(B))
// A mueve una ficha a jugada nueva → B lo ve en directo
const sA = await st(A)
const actor = sA.cur === sA.me ? A : B
const other = actor === A ? B : A
const tile = await actor.locator('#rack [data-tile]').first().getAttribute('data-tile')
await actor.locator(`#rack [data-tile="${tile}"]`).click()
await actor.getByText('+ Nueva jugada').click()
await actor.waitForTimeout(900)
console.log('borrador visto por el otro', (await st(other)).draft, (await other.locator(`.meld [data-tile="${tile}"]`).count()))
await other.screenshot({ path: 'shots/online-live.png' })
// el que tiene turno roba (se recoge solo)
await actor.locator('button:visible', { hasText: /Robar|Pasar/ }).click()
await actor.waitForTimeout(2500)
console.log('tras robar A', await st(A)); console.log('tras robar B', await st(B))
// el siguiente humano roba también
for (let i = 0; i < 6; i++) {
  for (const p of [A, B]) {
    const s = await st(p)
    if (s.cur === s.me && s.phase === 'play' && !(await p.evaluate(() => window.__game.getState().busy))) {
      await p.locator('button:visible', { hasText: /Robar|Pasar/ }).click().catch(() => {})
    }
  }
  await A.waitForTimeout(2200)
}
console.log('final A', await st(A)); console.log('final B', await st(B))
// reconexión: B recarga y sigue en la partida
await B.reload(); await B.waitForTimeout(3500)
console.log('B tras recargar', await st(B))
await B.screenshot({ path: 'shots/online-reload.png' })
await browser.close()
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'sin errores de consola')
