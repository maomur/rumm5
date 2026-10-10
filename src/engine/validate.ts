import { currentPlayer, draftChanged, meldKey, placedFromRack } from './queries'
import { analyzeMeld } from './tiles'
import type { Check, GameState, MoveTarget, TileId } from './types'

export type PlayCheck = (Check & { points?: number; firstMeld?: boolean; placed?: TileId[] })

function isTurnOf(s: GameState, playerId: string): Check {
  if (s.phase !== 'play') return { ok: false, reason: 'err.notPlaying' }
  if (currentPlayer(s).id !== playerId) return { ok: false, reason: 'err.notYourTurn' }
  return { ok: true }
}

/** Valida una mesa completa propuesta como final del turno */
export function validatePlay(s: GameState, playerId: string, melds: TileId[][]): PlayCheck {
  const turn = isTurnOf(s, playerId)
  if (!turn.ok) return turn
  const p = currentPlayer(s)
  const rack = new Set(p.rack)
  const before = new Set(s.table.flatMap((m) => m.tiles))
  const seen = new Set<TileId>()
  const placed: TileId[] = []
  for (const m of melds)
    for (const t of m) {
      if (seen.has(t)) return { ok: false, reason: 'err.duplicate' }
      seen.add(t)
      if (rack.has(t)) placed.push(t)
      else if (!before.has(t)) return { ok: false, reason: 'err.notYours' }
    }
  for (const t of before) if (!seen.has(t)) return { ok: false, reason: 'err.tableTileMissing' }
  if (placed.length === 0) return { ok: false, reason: 'err.nothingPlayed' }

  for (let i = 0; i < melds.length; i++) {
    const a = analyzeMeld(melds[i])
    if (!a.valid) return { ok: false, reason: a.reason === 'err.tooShort' ? 'err.meldTooShort' : 'err.invalidMeld', vars: { n: i + 1 } }
  }

  if (!p.hasMelded) {
    const originals = new Set(s.table.map((m) => meldKey(m.tiles)))
    let points = 0
    let kept = 0
    for (const m of melds) {
      if (originals.has(meldKey(m))) { kept++; continue }
      if (m.some((t) => !rack.has(t))) return { ok: false, reason: 'err.firstMeldOwnTiles' }
      const a = analyzeMeld(m)
      if (a.valid) points += a.points
    }
    if (kept !== s.table.length) return { ok: false, reason: 'err.firstMeldOwnTiles' }
    if (points < s.settings.initialMeld)
      return { ok: false, reason: 'err.firstMeld', vars: { points, need: s.settings.initialMeld } }
    return { ok: true, points, firstMeld: true, placed }
  }
  return { ok: true, points: 0, firstMeld: false, placed }
}

export function canEndTurn(s: GameState, playerId: string): PlayCheck {
  const turn = isTurnOf(s, playerId)
  if (!turn.ok) return turn
  if (!draftChanged(s) || placedFromRack(s).length === 0) return { ok: false, reason: 'err.nothingPlayed' }
  return validatePlay(s, playerId, s.draft.table.map((m) => m.tiles))
}

export function canMove(s: GameState, playerId: string, tiles: TileId[], to: MoveTarget): Check {
  const turn = isTurnOf(s, playerId)
  if (!turn.ok) return turn
  if (tiles.length === 0) return { ok: false, reason: 'err.noTiles' }
  const p = currentPlayer(s)
  const own = new Set(p.rack)
  const inDraftRack = new Set(s.draft.rack)
  const inDraftTable = new Set(s.draft.table.flatMap((m) => m.tiles))
  for (const t of tiles) if (!inDraftRack.has(t) && !inDraftTable.has(t)) return { ok: false, reason: 'err.noTiles' }
  if (to.kind === 'rack' && tiles.some((t) => !own.has(t))) return { ok: false, reason: 'err.tableTileToRack' }
  if (to.kind === 'meld' && !s.draft.table.some((m) => m.id === to.meldId)) return { ok: false, reason: 'err.noMeld' }
  // antes de la primera bajada no se puede tocar lo que ya había en la mesa
  if (!p.hasMelded) {
    const before = new Set(s.table.flatMap((m) => m.tiles))
    if (tiles.some((t) => before.has(t))) return { ok: false, reason: 'err.firstMeldNoTouch', vars: { need: s.settings.initialMeld } }
    if (to.kind === 'meld' && s.table.some((m) => m.id === to.meldId))
      return { ok: false, reason: 'err.firstMeldNoTouch', vars: { need: s.settings.initialMeld } }
  }
  return { ok: true }
}

export function canDraw(s: GameState, playerId: string): Check {
  return isTurnOf(s, playerId)
}

export function canUndo(s: GameState, playerId: string): Check {
  const turn = isTurnOf(s, playerId)
  if (!turn.ok) return turn
  return s.history.length > 0 ? { ok: true } : { ok: false, reason: 'err.nothingToUndo' }
}

export function canReset(s: GameState, playerId: string): Check {
  const turn = isTurnOf(s, playerId)
  if (!turn.ok) return turn
  return draftChanged(s) ? { ok: true } : { ok: false, reason: 'err.nothingToUndo' }
}
