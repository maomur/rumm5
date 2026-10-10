import { describe, expect, it } from 'vitest'
import { decideBot } from '../../src/engine/bot'
import { applyAction } from '../../src/engine/reducer'
import { solve } from '../../src/engine/solver'
import { createGame } from '../../src/engine/state'
import { analyzeMeld, tileId as T } from '../../src/engine/tiles'
import type { BotLevel, GameState } from '../../src/engine/types'

function tileCount(s: GameState) {
  return s.pool.length + s.table.reduce((a, m) => a + m.tiles.length, 0) + s.players.reduce((a, p) => a + p.rack.length, 0)
}

function playRound(seed: number, levels: BotLevel[], maxTurns = 600) {
  let s = createGame(levels.map((l, i) => ({ name: `Bot${i}`, isBot: true, botLevel: l })), seed)
  let turns = 0
  while (s.phase === 'play' && turns < maxTurns) {
    s = applyAction(s, decideBot(s))
    turns++
    expect(tileCount(s)).toBe(106)
    for (const m of s.table) expect(analyzeMeld(m.tiles).valid).toBe(true)
  }
  return { s, turns }
}

describe('buscador', () => {
  it('encuentra la escalera y deja lo que no sirve', () => {
    const r = solve([], [T(0, 3), T(0, 4), T(0, 5), T(1, 9)])
    expect(r?.used.sort()).toEqual([T(0, 3), T(0, 4), T(0, 5)].sort())
  })
  it('reorganiza la mesa para colocar fichas', () => {
    const table = [T(0, 4), T(0, 5), T(0, 6), T(0, 7)]
    const r = solve(table, [T(1, 7), T(2, 7)])
    expect(r?.used).toHaveLength(2)
    expect(r?.melds.every((m) => analyzeMeld(m).valid)).toBe(true)
  })
  it('usa los comodines', () => {
    const r = solve([], [T(2, 8), 104, T(2, 10)])
    expect(r?.used).toHaveLength(3)
  })
})

describe('partidas solo con bots', () => {
  it('terminan, conservan las fichas y la mesa siempre es válida', () => {
    for (const seed of [1, 2, 3, 7, 11]) {
      const { s } = playRound(seed, ['medium', 'easy', 'hard'])
      expect(s.phase).toBe('roundOver')
      const sum = Object.values(s.lastScores!).reduce((a, b) => a + b, 0)
      expect(sum).toBe(0)
    }
  })
  it('4 bots difíciles', () => {
    const { s } = playRound(99, ['hard', 'hard', 'hard', 'hard'])
    expect(s.phase).toBe('roundOver')
  })
  it('varias rondas seguidas', () => {
    let { s } = playRound(5, ['medium', 'medium'])
    for (let r = 0; r < 3; r++) {
      s = applyAction(s, { type: 'nextRound', playerId: s.players[0].id })
      while (s.phase === 'play') s = applyAction(s, decideBot(s))
    }
    expect(s.round).toBe(4)
    expect(s.players.reduce((a, p) => a + p.total, 0)).toBe(0)
  })
})
