import { currentPlayer, meldKey } from './queries'
import { dealRound } from './state'
import { rackPoints } from './tiles'
import type { Action, Draft, GameState, Meld, MoveTarget, TileId } from './types'
import { canDraw, canEndTurn, canMove, canReset, canUndo, validatePlay } from './validate'

const HISTORY_MAX = 60

export class RuleError extends Error {
  reason: string
  vars?: Record<string, string | number>
  constructor(reason: string, vars?: Record<string, string | number>) {
    super(reason)
    this.reason = reason
    this.vars = vars
  }
}

function must(check: { ok: boolean; reason?: string; vars?: Record<string, string | number> }) {
  if (!check.ok) throw new RuleError(check.reason ?? 'err.generic', check.vars)
}

const cloneDraft = (d: Draft): Draft => ({ table: d.table.map((m) => ({ id: m.id, tiles: [...m.tiles] })), rack: [...d.rack] })

function freshDraft(s: GameState): Draft {
  return { table: s.table.map((m) => ({ id: m.id, tiles: [...m.tiles] })), rack: [...currentPlayer(s).rack] }
}

/** Aplica una acción. Puro: devuelve un estado nuevo con los eventos de esta acción en `events`. */
export function applyAction(prev: GameState, action: Action): GameState {
  const s = structuredClone(prev)
  s.events = []
  switch (action.type) {
    case 'move': {
      must(canMove(s, action.playerId, action.tiles, action.to))
      pushHistory(s)
      moveTiles(s, action.tiles, action.to)
      break
    }
    case 'undo': {
      must(canUndo(s, action.playerId))
      s.draft = s.history.pop()!
      break
    }
    case 'reset': {
      must(canReset(s, action.playerId))
      pushHistory(s)
      s.draft = freshDraft(s)
      break
    }
    case 'endTurn': {
      must(canEndTurn(s, action.playerId))
      commit(s, s.draft.table.map((m) => m.tiles), s.draft.table)
      break
    }
    case 'play': {
      must(validatePlay(s, action.playerId, action.melds))
      commit(s, action.melds)
      break
    }
    case 'draw': {
      must(canDraw(s, action.playerId))
      drawAndPass(s, 1, false)
      break
    }
    case 'timeout': {
      if (s.phase !== 'play' || currentPlayer(s).id !== action.playerId) throw new RuleError('err.notYourTurn')
      const check = canEndTurn(s, action.playerId)
      if (check.ok) commit(s, s.draft.table.map((m) => m.tiles), s.draft.table)
      else drawAndPass(s, placedTouched(s) ? s.settings.penaltyTiles : 1, placedTouched(s))
      break
    }
    case 'nextRound': {
      if (s.phase !== 'roundOver') throw new RuleError('err.notPlaying')
      dealRound(s)
      break
    }
  }
  return s
}

/** ¿Había movido algo? (para decidir si hay penalización al agotar el tiempo) */
function placedTouched(s: GameState) {
  const before = new Set(s.table.map((m) => meldKey(m.tiles)))
  return s.draft.table.length !== s.table.length || s.draft.table.some((m) => !before.has(meldKey(m.tiles)))
}

function pushHistory(s: GameState) {
  s.history.push(cloneDraft(s.draft))
  if (s.history.length > HISTORY_MAX) s.history.shift()
}

function moveTiles(s: GameState, tiles: TileId[], to: MoveTarget) {
  const set = new Set(tiles)
  const d = s.draft
  d.rack = d.rack.filter((t) => !set.has(t))
  for (const m of d.table) m.tiles = m.tiles.filter((t) => !set.has(t))
  if (to.kind === 'rack') d.rack.push(...tiles)
  else if (to.kind === 'new') d.table.push({ id: s.nextMeldId++, tiles: [...tiles] })
  else d.table.find((m) => m.id === to.meldId)!.tiles.push(...tiles)
  d.table = d.table.filter((m) => m.tiles.length > 0)
}

/** Fija la nueva mesa, conserva ids de las jugadas que no han cambiado */
function commit(s: GameState, melds: TileId[][], withIds?: Meld[]) {
  const p = currentPlayer(s)
  const check = validatePlay(s, p.id, melds)
  if (!check.ok) throw new RuleError(check.reason, check.vars)
  const oldByKey = new Map(s.table.map((m) => [meldKey(m.tiles), m.id]))
  const table: Meld[] = melds.map((tiles, i) => {
    const kept = oldByKey.get(meldKey(tiles))
    const id = kept ?? withIds?.[i]?.id ?? s.nextMeldId++
    return { id, tiles: [...tiles] }
  })
  // ids únicos aunque el borrador haya reutilizado alguno
  const used = new Set<number>()
  for (const m of table) {
    if (used.has(m.id)) m.id = s.nextMeldId++
    used.add(m.id)
  }
  s.nextMeldId = Math.max(s.nextMeldId, ...table.map((m) => m.id + 1))
  const placed = new Set(check.placed!)
  p.rack = p.rack.filter((t) => !placed.has(t))
  const changedIds = table.filter((m) => !oldByKey.has(meldKey(m.tiles))).map((m) => m.id)
  s.table = table
  s.events.push({ type: 'play', playerId: p.id, tiles: [...placed], meldIds: changedIds, firstMeld: !!check.firstMeld, points: check.points ?? 0 })
  p.hasMelded = true
  s.passesInRow = 0
  if (p.rack.length === 0) {
    s.events.push({ type: 'rummy', playerId: p.id })
    endRound(s, p.id, false)
    return
  }
  nextTurn(s)
}

function drawAndPass(s: GameState, count: number, penalty: boolean) {
  const p = currentPlayer(s)
  const n = Math.min(count, s.pool.length)
  if (n === 0) {
    s.events.push({ type: 'pass', playerId: p.id })
    s.passesInRow += 1
    if (s.passesInRow >= s.players.length) {
      // bloqueo: gana quien tenga menos puntos en el atril
      const winner = [...s.players].sort((a, b) => rackPoints(a.rack) - rackPoints(b.rack) || a.rack.length - b.rack.length)[0]
      endRound(s, winner.id, true)
      return
    }
  } else {
    const tiles = s.pool.splice(0, n)
    p.rack.push(...tiles)
    s.events.push({ type: 'draw', playerId: p.id, count: n, tiles, penalty: penalty || undefined })
    s.passesInRow = 0
  }
  nextTurn(s)
}

function nextTurn(s: GameState) {
  s.current = (s.current + 1) % s.players.length
  s.turnNo += 1
  s.draft = freshDraft(s)
  s.history = []
  s.events.push({ type: 'turnStart', playerId: currentPlayer(s).id })
}

/** Puntuación oficial: el ganador suma lo que les queda a los demás; los demás restan lo suyo */
function endRound(s: GameState, winnerId: string, blocked: boolean) {
  const scores: Record<string, number> = {}
  let pot = 0
  for (const p of s.players) {
    if (p.id === winnerId) continue
    const pts = rackPoints(p.rack)
    if (blocked) {
      const w = rackPoints(s.players.find((x) => x.id === winnerId)!.rack)
      scores[p.id] = -(pts - w)
      pot += pts - w
    } else {
      scores[p.id] = -pts
      pot += pts
    }
  }
  scores[winnerId] = pot
  for (const p of s.players) p.total += scores[p.id]
  s.phase = 'roundOver'
  s.winnerId = winnerId
  s.lastScores = scores
  s.draft = { table: s.table.map((m) => ({ id: m.id, tiles: [...m.tiles] })), rack: [] }
  s.history = []
  s.events.push({ type: 'roundOver', winnerId, scores, blocked })
}
