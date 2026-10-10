import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'
const URL = 'http://localhost:5173/'
const browser = await chromium.launch()
const errors = []
async function player(name, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  await ctx.addInitScript((n) => localStorage.setItem('rumm5.prefs.v1', JSON.stringify({ muted: true, name: n })), name)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  await page.goto(url); await page.waitForTimeout(1800)
  return page
}
const screen = (p) => p.evaluate(() => window.__game.getState().screen)
const A = await player('Mauri', URL)
await A.getByText('Jugar con amigos').click()
await A.getByText('Crear sala').click(); await A.waitForTimeout(1500)
const code = await A.evaluate(() => new URLSearchParams(location.search).get('sala'))
const B = await player('Ana', URL + '?sala=' + code); await B.waitForTimeout(1500)
await A.getByText('Empezar partida').click(); await A.waitForTimeout(2500)
console.log('en partida:', await screen(A), await screen(B))
// los dos salen desde el menú
for (const p of [A, B]) {
  await p.getByLabel('Menú').click(); await p.waitForTimeout(300)
  await p.getByText('Salir de la sala').click(); await p.waitForTimeout(1500)
}
console.log('tras salir:', await screen(A), await screen(B))
// A intenta crear una sala nueva
await A.getByText('Jugar con amigos').click(); await A.waitForTimeout(1500)
const hasCreate = await A.getByText('Crear sala').count()
console.log('A ve "Crear sala":', hasCreate > 0, '| pantalla:', await screen(A))
await A.screenshot({ path: 'shots/leave-A.png' })
if (hasCreate) {
  await A.getByText('Crear sala').click(); await A.waitForTimeout(1500)
  const code2 = await A.evaluate(() => new URLSearchParams(location.search).get('sala'))
  console.log('sala nueva', code2, code2 !== code ? '✓ distinta' : '✗ la misma')
  // B entra en la nueva
  await B.goto(URL + '?sala=' + code2); await B.waitForTimeout(2500)
  await A.getByText('Empezar partida').click(); await A.waitForTimeout(2500)
  console.log('nueva partida:', await screen(A), await screen(B))
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'sin errores')
