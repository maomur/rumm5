import type { GameState } from '../engine/types'

const KEY = 'rumm5.save.v1'
const PREFS = 'rumm5.prefs.v1'

export function saveGame(game: GameState | null) {
  try {
    if (!game) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify({ ...game, events: [] }))
  } catch { /* */ }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const g = JSON.parse(raw) as GameState
    return g.version === 1 ? g : null
  } catch {
    return null
  }
}

export interface Prefs {
  muted: boolean
  sortMode: 'color' | 'number'
  name: string
}

export function loadPrefs(): Prefs {
  const def: Prefs = { muted: false, sortMode: 'color', name: '' }
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') }
  } catch {
    return def
  }
}

export function savePrefs(p: Partial<Prefs>) {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ ...loadPrefs(), ...p }))
  } catch { /* */ }
}
