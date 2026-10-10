import type { GameState, Meld, Player, TileId } from './types'

export const currentPlayer = (s: GameState): Player => s.players[s.current]
export const actorId = (s: GameState): string | null => (s.phase === 'play' ? currentPlayer(s).id : null)
export const playerById = (s: GameState, id: string) => s.players.find((p) => p.id === id)

export const tableTiles = (melds: Meld[]): Set<TileId> => new Set(melds.flatMap((m) => m.tiles))

/** Fichas del atril que el jugador ya ha puesto en la mesa este turno */
export function placedFromRack(s: GameState): TileId[] {
  const rack = new Set(currentPlayer(s).rack)
  return s.draft.table.flatMap((m) => m.tiles).filter((t) => rack.has(t))
}

const meldKey = (tiles: TileId[]) => [...tiles].sort((a, b) => a - b).join(',')

/** ¿Ha tocado algo el jugador este turno? */
export function draftChanged(s: GameState): boolean {
  if (s.draft.table.length !== s.table.length) return true
  const before = new Set(s.table.map((m) => meldKey(m.tiles)))
  return s.draft.table.some((m) => !before.has(meldKey(m.tiles)))
}

export function sameMeldTiles(a: TileId[], b: TileId[]) {
  return a.length === b.length && meldKey(a) === meldKey(b)
}

export { meldKey }
