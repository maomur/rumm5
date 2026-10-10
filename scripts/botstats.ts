import { decideBot } from '../src/engine/bot'
import { applyAction } from '../src/engine/reducer'
import { createGame } from '../src/engine/state'
import type { BotLevel } from '../src/engine/types'
const levels: BotLevel[] = ['easy','medium','hard']
const wins: Record<string, number> = {}, blocked = { n: 0 }; let turns = 0; let maxMs = 0
const N = 60
for (let seed = 1; seed <= N; seed++) {
  const order = [...levels].sort(() => 0).map((_, i) => levels[(i + seed) % 3])
  let s = createGame(order.map((l) => ({ name: l, isBot: true, botLevel: l })), seed * 7919)
  while (s.phase === 'play') { const t0 = performance.now(); const a = decideBot(s); maxMs = Math.max(maxMs, performance.now() - t0); s = applyAction(s, a); turns++ }
  const w = s.players.find((p) => p.id === s.winnerId)!.name
  wins[w] = (wins[w] ?? 0) + 1
  if (s.events.some((e) => e.type === 'roundOver' && e.blocked)) blocked.n++
}
console.log({ wins, blocked: blocked.n, avgTurns: turns / N, maxBotMs: Math.round(maxMs) })
