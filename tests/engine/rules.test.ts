import { describe, expect, it } from 'vitest'
import { applyAction, RuleError } from '../../src/engine/reducer'
import { createGame } from '../../src/engine/state'
import { analyzeMeld, colorOf, JOKERS, tileId as T, valueOf } from '../../src/engine/tiles'
import type { GameState, TileId } from '../../src/engine/types'
import { validatePlay } from '../../src/engine/validate'

const J1 = JOKERS[0]
const J2 = JOKERS[1]

function game(): GameState {
  return createGame([{ name: 'Ana', isBot: false }, { name: 'Bot', isBot: true }], 42)
}

/** Fuerza el atril del jugador actual (quitando esas fichas de donde estén) */
function withRack(s: GameState, rack: TileId[], table: TileId[][] = [], melded = false): GameState {
  const all = new Set([...rack, ...table.flat()])
  for (const p of s.players) p.rack = p.rack.filter((t) => !all.has(t))
  s.pool = s.pool.filter((t) => !all.has(t))
  s.players[s.current].rack = [...rack]
  s.players[s.current].hasMelded = melded
  s.table = table.map((tiles, i) => ({ id: i + 1, tiles }))
  s.nextMeldId = table.length + 1
  s.draft = { table: s.table.map((m) => ({ id: m.id, tiles: [...m.tiles] })), rack: [...rack] }
  s.history = []
  return s
}

const me = (s: GameState) => s.players[s.current].id

describe('fichas', () => {
  it('hay 106 fichas, 4 colores × 13 × 2 + 2 comodines', () => {
    const s = game()
    const total = s.pool.length + s.players.reduce((a, p) => a + p.rack.length, 0)
    expect(total).toBe(106)
    expect(s.players.every((p) => p.rack.length === 14)).toBe(true)
  })
  it('codificación', () => {
    expect(colorOf(T(2, 7, 1))).toBe(2)
    expect(valueOf(T(2, 7, 1))).toBe(7)
  })
})

describe('jugadas', () => {
  it('escalera válida', () => {
    const a = analyzeMeld([T(0, 5), T(0, 3), T(0, 4)])
    expect(a.valid && a.kind).toBe('run')
    expect(a.valid && a.points).toBe(12)
  })
  it('grupo válido de 3 y 4', () => {
    expect(analyzeMeld([T(0, 9), T(1, 9), T(2, 9)]).valid).toBe(true)
    expect(analyzeMeld([T(0, 9), T(1, 9), T(2, 9), T(3, 9)]).valid).toBe(true)
  })
  it('grupo con color repetido no vale', () => {
    expect(analyzeMeld([T(0, 9), T(0, 9, 1), T(2, 9)]).valid).toBe(false)
  })
  it('menos de 3 fichas no vale', () => {
    expect(analyzeMeld([T(0, 1), T(0, 2)]).valid).toBe(false)
  })
  it('escalera de colores mezclados no vale', () => {
    expect(analyzeMeld([T(0, 1), T(1, 2), T(0, 3)]).valid).toBe(false)
  })
  it('el 13 no enlaza con el 1', () => {
    expect(analyzeMeld([T(0, 12), T(0, 13), T(0, 1)]).valid).toBe(false)
  })
  it('comodín rellena hueco', () => {
    const a = analyzeMeld([T(1, 4), J1, T(1, 6)])
    expect(a.valid).toBe(true)
    if (a.valid) expect(a.ordered.map((p) => p.value)).toEqual([4, 5, 6])
  })
  it('comodín sobrante va arriba y, en el 13, abajo', () => {
    const a = analyzeMeld([T(1, 12), T(1, 13), J1])
    expect(a.valid && a.ordered.map((p) => p.value)).toEqual([11, 12, 13])
  })
  it('dos comodines con una ficha', () => {
    expect(analyzeMeld([T(3, 10), J1, J2]).valid).toBe(true)
  })
  it('grupo de 5 no vale', () => {
    expect(analyzeMeld([T(0, 2), T(1, 2), T(2, 2), T(3, 2), J1]).valid).toBe(false)
  })
})

describe('primera bajada', () => {
  it('menos de 30 puntos no vale', () => {
    const s = withRack(game(), [T(0, 1), T(0, 2), T(0, 3), T(1, 9)])
    const r = validatePlay(s, me(s), [[T(0, 1), T(0, 2), T(0, 3)]])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('err.firstMeld')
  })
  it('30 o más vale y suma varias jugadas', () => {
    const s = withRack(game(), [T(0, 9), T(0, 10), T(0, 11), T(1, 1), T(1, 2), T(1, 3), T(2, 5)])
    const r = validatePlay(s, me(s), [[T(0, 9), T(0, 10), T(0, 11)], [T(1, 1), T(1, 2), T(1, 3)]])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.points).toBe(36)
  })
  it('no se pueden usar fichas de la mesa en la primera bajada', () => {
    const table = [[T(2, 10), T(2, 11), T(2, 12)]]
    const s = withRack(game(), [T(2, 13), T(0, 10), T(1, 10), T(3, 10)], table)
    const r = validatePlay(s, me(s), [[T(2, 10), T(2, 11), T(2, 12), T(2, 13)], [T(0, 10), T(1, 10), T(3, 10)]])
    expect(r.ok).toBe(false)
  })
  it('no se puede mover una ficha de la mesa antes de bajar', () => {
    const table = [[T(2, 10), T(2, 11), T(2, 12)]]
    const s = withRack(game(), [T(2, 13), T(0, 1)], table)
    expect(() => applyAction(s, { type: 'move', playerId: me(s), tiles: [T(2, 10)], to: { kind: 'new' } })).toThrow(RuleError)
  })
})

describe('turno con borrador', () => {
  it('mover, deshacer y restablecer', () => {
    let s = withRack(game(), [T(0, 10), T(0, 11), T(0, 12), T(1, 1)])
    s = applyAction(s, { type: 'move', playerId: me(s), tiles: [T(0, 10), T(0, 11)], to: { kind: 'new' } })
    expect(s.draft.table).toHaveLength(1)
    expect(s.draft.rack).toHaveLength(2)
    const meldId = s.draft.table[0].id
    s = applyAction(s, { type: 'move', playerId: me(s), tiles: [T(0, 12)], to: { kind: 'meld', meldId } })
    expect(s.draft.table[0].tiles).toHaveLength(3)
    s = applyAction(s, { type: 'undo', playerId: me(s) })
    expect(s.draft.table[0].tiles).toHaveLength(2)
    s = applyAction(s, { type: 'reset', playerId: me(s) })
    expect(s.draft.table).toHaveLength(0)
    expect(s.draft.rack).toHaveLength(4)
  })
  it('terminar con una jugada inválida da error', () => {
    let s = withRack(game(), [T(0, 10), T(0, 11), T(1, 1)])
    s = applyAction(s, { type: 'move', playerId: me(s), tiles: [T(0, 10), T(0, 11)], to: { kind: 'new' } })
    expect(() => applyAction(s, { type: 'endTurn', playerId: me(s) })).toThrow(RuleError)
  })
  it('terminar con jugada válida pasa el turno y quita las fichas', () => {
    let s = withRack(game(), [T(0, 10), T(0, 11), T(0, 12), T(1, 1)])
    const who = me(s)
    s = applyAction(s, { type: 'move', playerId: who, tiles: [T(0, 10), T(0, 11), T(0, 12)], to: { kind: 'new' } })
    s = applyAction(s, { type: 'endTurn', playerId: who })
    expect(s.players.find((p) => p.id === who)!.rack).toEqual([T(1, 1)])
    expect(s.table).toHaveLength(1)
    expect(me(s)).not.toBe(who)
    expect(s.events.some((e) => e.type === 'play' && e.firstMeld)).toBe(true)
  })
  it('una ficha de la mesa no vuelve al atril', () => {
    const table = [[T(2, 10), T(2, 11), T(2, 12)]]
    const s = withRack(game(), [T(2, 13)], table, true)
    expect(() => applyAction(s, { type: 'move', playerId: me(s), tiles: [T(2, 10)], to: { kind: 'rack' } })).toThrow(RuleError)
  })
  it('reorganizar la mesa: partir una escalera y formar grupos', () => {
    const table = [[T(0, 4), T(0, 5), T(0, 6), T(0, 7)]]
    const s = withRack(game(), [T(1, 7), T(2, 7), T(0, 9)], table, true)
    const r = validatePlay(s, me(s), [[T(0, 4), T(0, 5), T(0, 6)], [T(0, 7), T(1, 7), T(2, 7)]])
    expect(r.ok).toBe(true)
  })
  it('robar pasa el turno con una ficha más', () => {
    let s = game()
    const who = me(s)
    const n = s.players[0].rack.length
    s = applyAction(s, { type: 'draw', playerId: who })
    expect(s.players[0].rack.length).toBe(n + 1)
    expect(me(s)).not.toBe(who)
  })
  it('no es tu turno', () => {
    const s = game()
    expect(() => applyAction(s, { type: 'draw', playerId: s.players[1].id })).toThrow(RuleError)
  })
  it('tiempo agotado con jugada inválida: penalización de 3', () => {
    let s = withRack(game(), [T(0, 10), T(0, 11), T(1, 1)])
    const who = me(s)
    s = applyAction(s, { type: 'move', playerId: who, tiles: [T(0, 10), T(0, 11)], to: { kind: 'new' } })
    s = applyAction(s, { type: 'timeout', playerId: who })
    expect(s.players.find((p) => p.id === who)!.rack).toHaveLength(6)
    expect(s.table).toHaveLength(0)
  })
  it('tiempo agotado con jugada válida: se juega', () => {
    let s = withRack(game(), [T(0, 10), T(0, 11), T(0, 12), T(1, 1)])
    const who = me(s)
    s = applyAction(s, { type: 'move', playerId: who, tiles: [T(0, 10), T(0, 11), T(0, 12)], to: { kind: 'new' } })
    s = applyAction(s, { type: 'timeout', playerId: who })
    expect(s.table).toHaveLength(1)
  })
})

describe('fin de ronda', () => {
  it('quedarse sin fichas gana y puntúa', () => {
    let s = withRack(game(), [T(0, 10), T(0, 11), T(0, 12)])
    const who = me(s)
    const other = s.players.find((p) => p.id !== who)!
    other.rack = [T(3, 5), J1]
    s = applyAction(s, { type: 'play', playerId: who, melds: [[T(0, 10), T(0, 11), T(0, 12)]] })
    expect(s.phase).toBe('roundOver')
    expect(s.winnerId).toBe(who)
    expect(s.lastScores![who]).toBe(35)
    expect(s.lastScores![other.id]).toBe(-35)
    s = applyAction(s, { type: 'nextRound', playerId: who })
    expect(s.phase).toBe('play')
    expect(s.round).toBe(2)
    expect(s.players.find((p) => p.id === who)!.total).toBe(35)
  })
  it('bolsa vacía y todos pasan: gana quien menos tenga', () => {
    let s = game()
    s.pool = []
    s.players[0].rack = [T(0, 1)]
    s.players[1].rack = [T(0, 13)]
    s.draft.rack = [...s.players[s.current].rack]
    s = applyAction(s, { type: 'draw', playerId: me(s) })
    s = applyAction(s, { type: 'draw', playerId: me(s) })
    expect(s.phase).toBe('roundOver')
    expect(s.winnerId).toBe(s.players[0].id)
  })
})
