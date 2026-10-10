import { currentPlayer } from './queries'
import { solve } from './solver'
import { analyzeMeld, penaltyValue } from './tiles'
import type { Action, BotLevel, GameState, TileId } from './types'
import { validatePlay } from './validate'

const BUDGET: Record<BotLevel, number> = { easy: 1500, medium: 6000, hard: 40000 }

const value = (tiles: TileId[]) => tiles.reduce((s, t) => s + penaltyValue(t), 0)

/** Jugadas nuevas solo con el atril + añadir fichas sueltas a jugadas de la mesa */
function simplePlay(s: GameState, level: BotLevel): TileId[][] | null {
  const p = currentPlayer(s)
  const own = solve([], p.rack, BUDGET[level])
  const table = s.table.map((m) => [...m.tiles])
  const usedOwn = new Set(own?.used ?? [])
  const melds = [...table, ...(own?.melds ?? [])]
  let rest = p.rack.filter((t) => !usedOwn.has(t))
  let changed = true
  while (changed) {
    changed = false
    for (const t of [...rest]) {
      const target = melds.find((m) => analyzeMeld([...m, t]).valid)
      if (target) {
        target.push(t)
        rest = rest.filter((x) => x !== t)
        changed = true
      }
    }
  }
  return rest.length < p.rack.length ? melds : null
}

function firstMeld(s: GameState, level: BotLevel): TileId[][] | null {
  const p = currentPlayer(s)
  const own = solve([], p.rack, BUDGET[level])
  if (!own || own.melds.length === 0) return null
  // nos quedamos con las jugadas de más puntos hasta llegar a 30, o con todas si es "difícil"
  const scored = own.melds.map((m) => ({ m, pts: (analyzeMeld(m) as { points?: number }).points ?? 0 })).sort((a, b) => b.pts - a.pts)
  const total = scored.reduce((a, b) => a + b.pts, 0)
  if (total < s.settings.initialMeld) return null
  const chosen = level === 'easy' ? takeUntil(scored, s.settings.initialMeld) : scored.map((x) => x.m)
  return [...s.table.map((m) => [...m.tiles]), ...chosen]
}

function takeUntil(scored: { m: TileId[]; pts: number }[], need: number) {
  const out: TileId[][] = []
  let sum = 0
  for (const x of scored) {
    out.push(x.m)
    sum += x.pts
    if (sum >= need) break
  }
  return out
}

/** Decide la acción del bot que tiene el turno. Puro. */
export function decideBot(s: GameState): Action {
  const p = currentPlayer(s)
  const level = p.botLevel
  const draw: Action = { type: 'draw', playerId: p.id }
  if (s.phase !== 'play') return draw

  const options: TileId[][][] = []
  if (!p.hasMelded) {
    const fm = firstMeld(s, level)
    if (fm) options.push(fm)
  } else {
    const simple = simplePlay(s, level)
    if (simple) options.push(simple)
    if (level !== 'easy') {
      const full = solve(s.table.flatMap((m) => m.tiles), p.rack, BUDGET[level])
      if (full && full.used.length > 0) options.push(full.melds)
    }
  }

  const tableSet = new Set(s.table.flatMap((m) => m.tiles))
  let best: { melds: TileId[][]; score: number } | null = null
  for (const melds of options) {
    if (!validatePlay(s, p.id, melds).ok) continue
    const placed = melds.flat().filter((t) => !tableSet.has(t))
    const score = value(placed)
    if (!best || score > best.score) best = { melds, score }
  }
  if (!best) return draw
  return { type: 'play', playerId: p.id, melds: best.melds }
}
