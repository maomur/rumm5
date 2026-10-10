import { readFileSync, writeFileSync } from 'node:fs'
import { applyAction } from '../src/engine/reducer'
import type { GameState } from '../src/engine/types'
// partida terminada (con su evento roundOver) y la ronda siguiente, como las manda el servidor
const over: GameState = JSON.parse(readFileSync('shots/over.json', 'utf8'))
over.players.forEach((p) => (p.isBot = false))
const next = applyAction(over, { type: 'nextRound', playerId: over.players[0].id })
writeFileSync('shots/remote-over.json', JSON.stringify({ game: over, events: [{ type: 'rummy', playerId: over.winnerId }, { type: 'roundOver', winnerId: over.winnerId, scores: over.lastScores, blocked: false }] }))
writeFileSync('shots/remote-next.json', JSON.stringify({ game: next, events: next.events }))
console.log('turno de', next.players[next.current].id)
