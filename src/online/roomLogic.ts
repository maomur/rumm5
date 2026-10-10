// Lógica de sala PURA (sin red ni temporizadores): la usa el Durable Object y se testea con Vitest
import { decideBot } from '../engine/bot'
import { currentPlayer } from '../engine/queries'
import { applyAction, RuleError } from '../engine/reducer'
import { createGame } from '../engine/state'
import type { Action, BotLevel, GameEvent, GameState } from '../engine/types'
import { GRACE_MS, MAX_SEATS, type ClientMsg, type RoomView } from './protocol'

export interface Seat {
  id: string
  key: string | null
  name: string
  isBot: boolean
  botLevel: BotLevel
  connected: boolean
  disconnectedAt: number | null
}

export interface Room {
  code: string
  seats: Seat[]
  hostKey: string | null
  game: GameState | null
  turnSeconds: number
  deadline: number | null
  seatSeq: number
}

export interface HandleResult {
  room?: boolean
  state?: { events: GameEvent[]; by: string | null; seq: number | null }
  error?: { reason: string; vars?: Record<string, string | number> }
}

const BOT_NAMES = ['Lola', 'Pau', 'Nuria', 'Jordi']

// Debe sumar lo mismo que la cola del cliente (gameStore) para no adelantarse a la animación
export function animationBudgetMs(events: GameEvent[]): number {
  let ms = 0
  for (const e of events) {
    if (e.type === 'turnStart') ms += 450
    else if (e.type === 'draw') ms += e.penalty ? 2600 : 800
    else if (e.type === 'pass') ms += 1000
    else if (e.type === 'play') ms += e.firstMeld ? 2200 : 1300
    else if (e.type === 'rummy') ms += 900
  }
  return ms
}

export class RoomLogic {
  room: Room
  constructor(room: Room) {
    this.room = room
  }

  static create(code: string): RoomLogic {
    return new RoomLogic({ code, seats: [], hostKey: null, game: null, turnSeconds: 0, deadline: null, seatSeq: 0 })
  }

  seatOf(key: string) {
    return this.room.seats.find((s) => s.key === key)
  }

  view(version: string): RoomView {
    const r = this.room
    return {
      code: r.code,
      started: !!r.game,
      turnSeconds: r.turnSeconds,
      version,
      seats: r.seats.map((s) => ({ id: s.id, name: s.name, isBot: s.isBot, botLevel: s.botLevel, connected: s.isBot || s.connected, host: !!s.key && s.key === r.hostKey })),
    }
  }

  connect(key: string, connected: boolean, now: number) {
    const seat = this.seatOf(key)
    if (!seat) return false
    seat.connected = connected
    seat.disconnectedAt = connected ? null : now
    return true
  }

  handle(key: string, msg: ClientMsg, now: number): HandleResult {
    const r = this.room
    const seat = this.seatOf(key)
    const isHost = key === r.hostKey
    switch (msg.t) {
      case 'hello': {
        const name = msg.name.trim().slice(0, 12) || 'Jugador'
        if (seat) {
          seat.connected = true
          seat.disconnectedAt = null
          seat.name = name
          if (r.game) {
            const p = r.game.players.find((x) => x.id === seat.id)
            if (p) p.name = name
          }
          return { room: true }
        }
        if (r.game) return { error: { reason: 'online.started' } }
        if (r.seats.length >= MAX_SEATS) return { error: { reason: 'online.full' } }
        r.seats.push({ id: `s${++r.seatSeq}`, key, name, isBot: false, botLevel: 'medium', connected: true, disconnectedAt: null })
        if (!r.hostKey || !r.seats.some((s) => s.key === r.hostKey)) r.hostKey = key
        return { room: true }
      }
      case 'addBot': {
        if (!isHost || r.game) return { error: { reason: 'online.onlyHost' } }
        if (r.seats.length >= MAX_SEATS) return { error: { reason: 'online.full' } }
        const used = new Set(r.seats.map((s) => s.name))
        const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot${r.seatSeq}`
        r.seats.push({ id: `s${++r.seatSeq}`, key: null, name, isBot: true, botLevel: msg.level, connected: true, disconnectedAt: null })
        return { room: true }
      }
      case 'removeSeat': {
        if (!isHost || r.game) return { error: { reason: 'online.onlyHost' } }
        const target = r.seats.find((s) => s.id === msg.seatId)
        if (!target || target.key === r.hostKey) return {}
        r.seats = r.seats.filter((s) => s !== target)
        return { room: true }
      }
      case 'settings': {
        if (!isHost || r.game) return { error: { reason: 'online.onlyHost' } }
        r.turnSeconds = [0, 60, 90, 120].includes(msg.turnSeconds) ? msg.turnSeconds : 0
        return { room: true }
      }
      case 'start': {
        if (!isHost) return { error: { reason: 'online.onlyHost' } }
        if (r.game) return {}
        if (r.seats.length < 2) return { error: { reason: 'online.needTwo' } }
        r.game = createGame(
          r.seats.map((s) => ({ id: s.id, name: s.name, isBot: s.isBot, botLevel: s.botLevel })),
          (now * 2654435761) >>> 0,
          { turnSeconds: r.turnSeconds },
        )
        const events = r.game.events
        this.updateDeadline(events, now)
        return { room: true, state: { events, by: null, seq: null } }
      }
      case 'action': {
        if (!r.game || !seat) return { error: { reason: 'err.notPlaying' } }
        const a = { ...msg.action, playerId: seat.id } as Action
        if (a.type === 'nextRound') {
          if (!isHost) return { error: { reason: 'online.onlyHost' } }
        } else if (!this.mayAct(seat.id)) return { error: { reason: 'err.notYourTurn' } }
        return this.apply(a, now, seat.id, msg.seq)
      }
    }
  }

  mayAct(seatId: string) {
    const g = this.room.game
    return !!g && g.phase === 'play' && currentPlayer(g).id === seatId
  }

  apply(a: Action, now: number, by: string | null, seq: number | null): HandleResult {
    const r = this.room
    try {
      r.game = applyAction(r.game!, a)
    } catch (e) {
      if (e instanceof RuleError) return { error: { reason: e.reason, vars: e.vars } }
      throw e
    }
    const events = r.game.events
    this.updateDeadline(events, now)
    return { state: { events, by, seq } }
  }

  private updateDeadline(events: GameEvent[], now: number) {
    const g = this.room.game!
    if (g.phase !== 'play') { this.room.deadline = null; return }
    if (!events.some((e) => e.type === 'turnStart')) return
    const p = currentPlayer(g)
    this.room.deadline = g.settings.turnSeconds > 0 && !p.isBot ? now + animationBudgetMs(events) + g.settings.turnSeconds * 1000 : null
  }

  /** ¿Quién debe actuar sin que nadie toque nada? (bots, humanos ausentes, tiempo agotado) */
  pendingAutoActor(now: number): { at: number; kind: 'bot' | 'absent' | 'timeout' } | null {
    const r = this.room
    const g = r.game
    if (!g || g.phase !== 'play') return null
    const p = currentPlayer(g)
    const seat = r.seats.find((s) => s.id === p.id)
    if (!seat) return null
    if (seat.isBot) return { at: now, kind: 'bot' }
    if (!seat.connected && seat.disconnectedAt !== null) return { at: seat.disconnectedAt + GRACE_MS, kind: 'absent' }
    if (r.deadline) return { at: r.deadline, kind: 'timeout' }
    return null
  }

  runAuto(kind: 'bot' | 'absent' | 'timeout', now: number): HandleResult {
    const g = this.room.game!
    const p = currentPlayer(g)
    if (kind === 'timeout') return this.apply({ type: 'timeout', playerId: p.id }, now, null, null)
    const a = kind === 'absent' ? decideBot({ ...g, players: g.players.map((x) => (x.id === p.id ? { ...x, botLevel: 'medium' as BotLevel } : x)) }) : decideBot(g)
    return this.apply(a, now, null, null)
  }
}
