// Buscador de jugadas: reparte fichas obligatorias (las de la mesa) y opcionales (las del atril)
// en jugadas válidas, maximizando el valor de las fichas del atril que se colocan.
import { analyzeMeld, colorOf, isJoker, penaltyValue, valueOf } from './tiles'
import type { TileId } from './types'

export interface SolveResult {
  melds: TileId[][]
  used: TileId[]
  score: number
  complete: boolean
}

type Spec = { c: number; v: number } | 'J'

export function solve(mandatory: TileId[], optional: TileId[], nodeLimit = 20000): SolveResult | null {
  const mand: TileId[][][] = Array.from({ length: 4 }, () => Array.from({ length: 14 }, () => []))
  const opt: TileId[][][] = Array.from({ length: 4 }, () => Array.from({ length: 14 }, () => []))
  const mandJ: TileId[] = []
  const optJ: TileId[] = []
  for (const t of mandatory) isJoker(t) ? mandJ.push(t) : mand[colorOf(t)][valueOf(t)].push(t)
  for (const t of optional) isJoker(t) ? optJ.push(t) : opt[colorOf(t)][valueOf(t)].push(t)
  const optSet = new Set(optional)

  let optRemaining = optional.reduce((s, t) => s + penaltyValue(t), 0)
  let nodes = 0
  let aborted = false
  let best: SolveResult | null = null
  const melds: TileId[][] = []
  let usedScore = 0

  const avail = (c: number, v: number) => mand[c][v].length + opt[c][v].length
  const jokers = () => mandJ.length + optJ.length

  function takeReal(c: number, v: number): TileId {
    const t = mand[c][v].length ? mand[c][v].pop()! : opt[c][v].pop()!
    if (optSet.has(t)) { usedScore += penaltyValue(t); optRemaining -= penaltyValue(t) }
    return t
  }
  function takeJoker(): TileId {
    const t = mandJ.length ? mandJ.pop()! : optJ.pop()!
    if (optSet.has(t)) { usedScore += penaltyValue(t); optRemaining -= penaltyValue(t) }
    return t
  }
  function giveBack(t: TileId) {
    const isOpt = optSet.has(t)
    if (isOpt) { usedScore -= penaltyValue(t); optRemaining += penaltyValue(t) }
    if (isJoker(t)) (isOpt ? optJ : mandJ).push(t)
    else (isOpt ? opt : mand)[colorOf(t)][valueOf(t)].push(t)
  }

  function finalize() {
    // comodines sobrantes: se pegan a alguna jugada donde quepan
    const result = melds.map((m) => [...m])
    const leftoverMand = [...mandJ]
    const leftoverOpt = [...optJ]
    let score = usedScore
    for (const j of [...leftoverMand, ...leftoverOpt]) {
      const target = result.find((m) => analyzeMeld([...m, j]).valid)
      if (target) {
        target.push(j)
        if (optSet.has(j)) score += penaltyValue(j)
      } else if (!optSet.has(j)) return
    }
    if (!best || score > best.score) {
      const used = result.flat().filter((t) => optSet.has(t))
      best = { melds: result, used, score, complete: false }
    }
  }

  function lowest(): [number, number] | null {
    for (let v = 1; v <= 13; v++) for (let c = 0; c < 4; c++) if (avail(c, v)) return [c, v]
    return null
  }

  function candidates(c: number, v: number): Spec[][] {
    const out: Spec[][] = []
    const J = jokers()
    // escaleras donde (c,v) es la ficha real más baja; k comodines delante
    for (let k = 0; k <= Math.min(2, J) && v - k >= 1; k++) {
      const base: Spec[] = Array(k).fill('J')
      base.push({ c, v })
      let jLeft = J - k
      const real = new Map<number, number>()
      real.set(v, 1)
      const runs: Spec[][] = []
      const cur = [...base]
      for (let w = v + 1; w <= 13; w++) {
        if (avail(c, w) > 0) cur.push({ c, v: w })
        else if (jLeft > 0) { cur.push('J'); jLeft-- }
        else break
        if (cur.length >= 3) runs.push([...cur])
      }
      out.push(...runs.reverse())
    }
    // grupos de valor v
    const others = [0, 1, 2, 3].filter((x) => x !== c && avail(x, v) > 0)
    const subsets: number[][] = [[]]
    for (const o of others) for (const s of [...subsets]) subsets.push([...s, o])
    subsets.sort((a, b) => b.length - a.length)
    for (const sub of subsets) {
      for (const size of [4, 3]) {
        const need = size - 1 - sub.length
        if (need < 0 || need > J || need > 2) continue
        out.push([{ c, v }, ...sub.map((o) => ({ c: o, v })), ...Array(need).fill('J')])
      }
    }
    return out
  }

  function dfs() {
    if (aborted) return
    if (++nodes > nodeLimit) { aborted = true; return }
    if (best && usedScore + optRemaining <= (best as SolveResult).score) return
    const slot = lowest()
    if (!slot) { finalize(); return }
    const [c, v] = slot
    for (const spec of candidates(c, v)) {
      const taken: TileId[] = []
      let okTake = true
      for (const s of spec) {
        if (s === 'J') { if (!jokers()) { okTake = false; break } taken.push(takeJoker()) }
        else { if (!avail(s.c, s.v)) { okTake = false; break } taken.push(takeReal(s.c, s.v)) }
      }
      if (okTake) {
        melds.push(taken)
        dfs()
        melds.pop()
      }
      for (let i = taken.length - 1; i >= 0; i--) giveBack(taken[i])
      if (aborted) return
    }
    // si la ficha más baja es opcional, se puede dejar en el atril
    if (mand[c][v].length === 0 && opt[c][v].length > 0) {
      const t = opt[c][v].pop()!
      optRemaining -= penaltyValue(t)
      dfs()
      optRemaining += penaltyValue(t)
      opt[c][v].push(t)
    }
  }

  dfs()
  if (best) (best as SolveResult).complete = !aborted
  return best
}
