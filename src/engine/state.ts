import { shuffle } from './rng'
import { allTiles } from './tiles'
import type { BotLevel, GameState, Player, Settings } from './types'

export interface PlayerSetup {
  id?: string
  name: string
  isBot: boolean
  botLevel?: BotLevel
}

export const DEFAULT_SETTINGS: Settings = { initialMeld: 30, rackSize: 14, turnSeconds: 0, penaltyTiles: 3 }

export function createGame(setup: PlayerSetup[], seed = Date.now() >>> 0, settings: Partial<Settings> = {}): GameState {
  if (setup.length < 2 || setup.length > 4) throw new Error('2 a 4 jugadores')
  const players: Player[] = setup.map((p, i) => ({
    id: p.id ?? `p${i}`,
    name: p.name,
    isBot: p.isBot,
    botLevel: p.botLevel ?? 'medium',
    rack: [],
    hasMelded: false,
    total: 0,
    avatar: i,
  }))
  const state: GameState = {
    version: 1,
    rng: seed | 0,
    players,
    current: 0,
    pool: [],
    table: [],
    draft: { table: [], rack: [] },
    history: [],
    phase: 'play',
    round: 0,
    turnNo: 0,
    passesInRow: 0,
    nextMeldId: 1,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    winnerId: null,
    lastScores: null,
    events: [],
  }
  dealRound(state)
  return state
}

/** Reparte una ronda nueva (muta el estado) */
export function dealRound(state: GameState) {
  const pool = allTiles()
  state.rng = shuffle(pool, state.rng)
  for (const p of state.players) {
    p.rack = pool.splice(0, state.settings.rackSize)
    p.hasMelded = false
  }
  state.pool = pool
  state.table = []
  state.round += 1
  state.turnNo = 1
  state.passesInRow = 0
  state.nextMeldId = 1
  state.phase = 'play'
  state.winnerId = null
  // en cada ronda empieza el siguiente jugador
  state.current = (state.round - 1) % state.players.length
  state.draft = { table: [], rack: [...state.players[state.current].rack] }
  state.history = []
  state.events.push({ type: 'turnStart', playerId: state.players[state.current].id })
}
