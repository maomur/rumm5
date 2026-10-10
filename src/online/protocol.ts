import type { Action, BotLevel, GameEvent, GameState } from '../engine/types'

export interface SeatView {
  id: string
  name: string
  isBot: boolean
  botLevel: BotLevel
  connected: boolean
  host: boolean
}

export interface RoomView {
  code: string
  seats: SeatView[]
  started: boolean
  turnSeconds: number
  version: string
}

export type ClientMsg =
  | { t: 'hello'; key: string; name: string }
  | { t: 'addBot'; level: BotLevel }
  | { t: 'removeSeat'; seatId: string }
  | { t: 'settings'; turnSeconds: number }
  | { t: 'start' }
  | { t: 'action'; action: Action; seq: number }

export type ServerMsg =
  | { t: 'room'; room: RoomView; you: string | null }
  | { t: 'state'; game: GameState; events: GameEvent[]; deadline: number | null; by: string | null; seq: number | null }
  | { t: 'error'; reason: string; vars?: Record<string, string | number>; seq?: number }

export const MAX_SEATS = 4
export const GRACE_MS = 20_000
