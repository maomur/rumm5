import type { Color, TileId } from './types'

export const TILE_COUNT = 106
export const JOKER_POINTS = 30
export const COLORS: Color[] = [0, 1, 2, 3]

export const isJoker = (t: TileId) => t >= 104
export const colorOf = (t: TileId): Color => Math.floor(t / 26) as Color
export const valueOf = (t: TileId) => (t % 26) % 13 + 1
export const tileId = (color: Color, value: number, copy = 0): TileId => color * 26 + copy * 13 + (value - 1)
export const JOKERS: TileId[] = [104, 105]

export function allTiles(): TileId[] {
  return Array.from({ length: TILE_COUNT }, (_, i) => i)
}

/** Puntos que cuesta una ficha que se queda en el atril al acabar la ronda */
export const penaltyValue = (t: TileId) => (isJoker(t) ? JOKER_POINTS : valueOf(t))
export const rackPoints = (rack: TileId[]) => rack.reduce((s, t) => s + penaltyValue(t), 0)

export interface PlacedTile {
  tile: TileId
  /** valor que representa (para el comodín, el que sustituye) */
  value: number
  color: Color | null
}

export type MeldAnalysis =
  | { valid: true; kind: 'run' | 'group'; ordered: PlacedTile[]; points: number }
  | { valid: false; reason: string; ordered: PlacedTile[] }

function asRun(tiles: TileId[]): Extract<MeldAnalysis, { valid: true }> | null {
  const jokers = tiles.filter(isJoker)
  const nums = tiles.filter((t) => !isJoker(t))
  if (nums.length === 0) return null
  const color = colorOf(nums[0])
  if (nums.some((t) => colorOf(t) !== color)) return null
  const vals = nums.map(valueOf).sort((a, b) => a - b)
  for (let i = 1; i < vals.length; i++) if (vals[i] === vals[i - 1]) return null
  const span = vals[vals.length - 1] - vals[0] + 1
  const gaps = span - vals.length
  if (gaps > jokers.length) return null
  const len = tiles.length
  if (len > 13) return null
  // los comodines sobrantes van arriba (más puntos) y, si no caben, abajo
  let extra = jokers.length - gaps
  let lo = vals[0]
  let hi = vals[vals.length - 1]
  while (extra > 0 && hi < 13) { hi++; extra-- }
  while (extra > 0 && lo > 1) { lo--; extra-- }
  if (extra > 0) return null
  const byVal = new Map(nums.map((t) => [valueOf(t), t]))
  const js = [...jokers]
  const ordered: PlacedTile[] = []
  for (let v = lo; v <= hi; v++) {
    const t = byVal.get(v)
    if (t !== undefined) ordered.push({ tile: t, value: v, color })
    else ordered.push({ tile: js.shift()!, value: v, color })
  }
  return { valid: true, kind: 'run', ordered, points: ordered.reduce((s, p) => s + p.value, 0) }
}

function asGroup(tiles: TileId[]): Extract<MeldAnalysis, { valid: true }> | null {
  if (tiles.length > 4) return null
  const jokers = tiles.filter(isJoker)
  const nums = tiles.filter((t) => !isJoker(t))
  if (nums.length === 0) return null
  const v = valueOf(nums[0])
  if (nums.some((t) => valueOf(t) !== v)) return null
  const colors = new Set(nums.map(colorOf))
  if (colors.size !== nums.length) return null
  const sorted = [...nums].sort((a, b) => colorOf(a) - colorOf(b))
  const free = ([0, 1, 2, 3] as Color[]).filter((c) => !colors.has(c))
  const ordered: PlacedTile[] = sorted.map((t) => ({ tile: t, value: v, color: colorOf(t) }))
  for (const j of jokers) ordered.push({ tile: j, value: v, color: free.shift() ?? null })
  return { valid: true, kind: 'group', ordered, points: v * tiles.length }
}

/** Fallback para mostrar jugadas inválidas de forma estable: color y luego número */
export function displaySort(tiles: TileId[]): TileId[] {
  return [...tiles].sort((a, b) => {
    if (isJoker(a) !== isJoker(b)) return isJoker(a) ? 1 : -1
    if (isJoker(a)) return a - b
    return colorOf(a) - colorOf(b) || valueOf(a) - valueOf(b) || a - b
  })
}

export function analyzeMeld(tiles: TileId[]): MeldAnalysis {
  const fallback = () =>
    displaySort(tiles).map((t) => ({ tile: t, value: isJoker(t) ? 0 : valueOf(t), color: isJoker(t) ? null : colorOf(t) }))
  if (tiles.length < 3) return { valid: false, reason: 'err.tooShort', ordered: fallback() }
  const run = asRun(tiles)
  const group = asGroup(tiles)
  const best = run && group ? (run.points >= group.points ? run : group) : run ?? group
  if (best) return best
  return { valid: false, reason: 'err.badMeld', ordered: fallback() }
}

export const isValidMeld = (tiles: TileId[]) => analyzeMeld(tiles).valid
