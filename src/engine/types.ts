// Rumm5 — tipos del motor (puro, sin React ni DOM)

/** Ficha: 0..103 = número (4 colores × 13 valores × 2 copias); 104 y 105 = comodines */
export type TileId = number

export type Color = 0 | 1 | 2 | 3

export interface Meld {
  id: number
  tiles: TileId[]
}

export type BotLevel = 'easy' | 'medium' | 'hard'

export interface Player {
  id: string
  name: string
  isBot: boolean
  botLevel: BotLevel
  rack: TileId[]
  hasMelded: boolean
  /** puntuación acumulada entre rondas */
  total: number
  avatar: number
}

export interface Draft {
  table: Meld[]
  rack: TileId[]
}

export interface Settings {
  initialMeld: number
  rackSize: number
  /** segundos por turno; 0 = sin límite */
  turnSeconds: number
  /** fichas de penalización si se acaba el tiempo con jugada inválida */
  penaltyTiles: number
}

export type Phase = 'play' | 'roundOver'

export type GameEvent =
  | { type: 'turnStart'; playerId: string }
  | { type: 'draw'; playerId: string; count: number; tiles: TileId[]; penalty?: boolean }
  | { type: 'pass'; playerId: string }
  | { type: 'play'; playerId: string; tiles: TileId[]; meldIds: number[]; firstMeld: boolean; points: number }
  | { type: 'rummy'; playerId: string }
  | { type: 'roundOver'; winnerId: string; scores: Record<string, number>; blocked: boolean }

export interface GameState {
  version: 1
  rng: number
  players: Player[]
  current: number
  pool: TileId[]
  table: Meld[]
  /** borrador del turno actual (lo que el jugador va moviendo) */
  draft: Draft
  history: Draft[]
  phase: Phase
  round: number
  turnNo: number
  passesInRow: number
  nextMeldId: number
  settings: Settings
  winnerId: string | null
  lastScores: Record<string, number> | null
  events: GameEvent[]
}

export type MoveTarget = { kind: 'meld'; meldId: number } | { kind: 'new' } | { kind: 'rack' }

export type Action =
  | { type: 'move'; playerId: string; tiles: TileId[]; to: MoveTarget }
  | { type: 'undo'; playerId: string }
  | { type: 'reset'; playerId: string }
  | { type: 'endTurn'; playerId: string }
  | { type: 'draw'; playerId: string }
  /** jugada completa en un solo paso (bots) */
  | { type: 'play'; playerId: string; melds: TileId[][] }
  /** se acabó el tiempo del turno */
  | { type: 'timeout'; playerId: string }
  | { type: 'nextRound'; playerId: string }

export type Check = { ok: true } | { ok: false; reason: string; vars?: Record<string, string | number> }
