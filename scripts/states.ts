import { readFileSync, writeFileSync } from 'node:fs'
import { decideBot } from '../src/engine/bot'
import { applyAction } from '../src/engine/reducer'
import { createGame } from '../src/engine/state'
import type { GameState } from '../src/engine/types'
const setup = [{ name: 'Mauricio', isBot: false }, { name: 'Lola', isBot: true }, { name: 'Pau', isBot: true }, { name: 'Nuria', isBot: true }]
const save = (n: string, g: GameState) => writeFileSync(`shots/${n}.json`, JSON.stringify({ ...g, events: [] }))
save('start', createGame(setup, 1234))
// mitad: todos bots hasta que haya mesa y el humano haya bajado
let g!: GameState
for (let seed = 700; ; seed++) {
  g = createGame(setup.map((p) => ({ ...p, isBot: true })), seed)
  let turns = 0
  while (g.phase === 'play' && !(turns >= 20 && g.current === 0 && g.players[0].hasMelded && g.players[0].rack.length >= 7)) { g = applyAction(g, decideBot(g)); turns++ }
  if (g.phase === 'play') break
}
g.players[0].isBot = false
save('mid', g)
while (g.phase === 'play') { g.players[0].isBot = true; g = applyAction(g, decideBot(g)) }
g.players[0].isBot = false
save('over', g)
// 'play': partida a mitad con una ficha que alarga una escalera de la mesa
{
  const s: GameState = JSON.parse(readFileSync('shots/mid.json', 'utf8'))
  const { analyzeMeld, tileId } = await import('../src/engine/tiles')
  for (const m of s.table) {
    const a = analyzeMeld(m.tiles)
    if (!a.valid || a.kind !== 'run') continue
    const last = a.ordered[a.ordered.length - 1]
    if (last.value >= 13 || last.color === null) continue
    const want = [tileId(last.color, last.value + 1, 0), tileId(last.color, last.value + 1, 1)]
    const onTable = new Set(s.table.flatMap((x) => x.tiles))
    const tile = want.find((t) => !onTable.has(t))
    if (tile === undefined) continue
    for (const p of s.players) p.rack = p.rack.filter((t) => t !== tile)
    s.pool = s.pool.filter((t) => t !== tile)
    s.players[0].rack.push(tile)
    s.draft = { table: s.table.map((x) => ({ id: x.id, tiles: [...x.tiles] })), rack: [...s.players[0].rack] }
    writeFileSync('shots/play.json', JSON.stringify({ ...s, events: [] }))
    writeFileSync('shots/play-info.json', JSON.stringify({ tile, meldId: m.id }))
    break
  }
}
