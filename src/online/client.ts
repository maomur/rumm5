import PartySocket from 'partysocket'
import { create } from 'zustand'
import { sfx } from '../audio/sfx'
import type { Action } from '../engine/types'
import { t } from '../i18n'
import { useGame } from '../store/gameStore'
import { PARTY_HOST } from './config'
import { deviceKey } from './identity'
import type { ClientMsg, RoomView, ServerMsg } from './protocol'

interface OnlineState {
  code: string | null
  status: 'idle' | 'connecting' | 'open' | 'closed'
  room: RoomView | null
  you: string | null
  error: string | null
}

export const useOnline = create<OnlineState>(() => ({ code: null, status: 'idle', room: null, you: null, error: null }))

let socket: PartySocket | null = null
let seq = 0
let lastSent = 0

function send(m: ClientMsg) {
  socket?.send(JSON.stringify(m))
}

export function sendAction(a: Action) {
  seq += 1
  lastSent = seq
  send({ t: 'action', action: a, seq })
}

export function connect(code: string, name: string) {
  closeSocket()
  useOnline.setState({ code, status: 'connecting', room: null, you: null, error: null })
  try { localStorage.setItem('rumm5.lastRoom', code) } catch { /* */ }
  const sock = new PartySocket({ host: PARTY_HOST, party: 'game-room', room: code })
  socket = sock
  const key = deviceKey()
  // una conexión vieja (de una sala de la que ya salimos) no debe tocar nada
  const stale = () => socket !== sock
  sock.addEventListener('open', () => {
    if (stale()) return
    useOnline.setState({ status: 'open' })
    send({ t: 'hello', key, name }) // reidentificarse en cada (re)conexión
  })
  sock.addEventListener('close', () => { if (!stale()) useOnline.setState({ status: 'closed' }) })
  sock.addEventListener('message', (e) => {
    if (stale()) return
    const m = JSON.parse(String(e.data)) as ServerMsg
    if (m.t === 'room') {
      useOnline.setState({ room: m.room, you: m.you })
      return
    }
    if (m.t === 'error') {
      const g = useGame.getState()
      if (m.reason.startsWith('online.')) useOnline.setState({ error: m.reason })
      sfx.deny()
      g.showToast(t(m.reason, m.vars), 'error')
      return
    }
    if (m.t === 'state') {
      const you = useOnline.getState().you
      const g = useGame.getState()
      if (g.mode !== 'online' || g.screen !== 'game') g.startOnline(you ?? '', sendAction, leaveRoom)
      // eco de mi propio movimiento del borrador cuando ya he hecho otro después: lo salto
      if (m.by && m.by === you && m.seq !== null && m.seq < lastSent && m.events.length === 0) return
      useGame.getState().applyRemote(m.game, m.events, m.deadline)
    }
  })
}

function closeSocket() {
  const old = socket
  socket = null
  old?.close()
}

/** Salir de la sala de verdad: se cierra la conexión y la app olvida la sala */
export function leaveRoom() {
  closeSocket()
  useOnline.setState({ code: null, status: 'idle', room: null, you: null, error: null })
  try { localStorage.removeItem('rumm5.lastRoom') } catch { /* */ }
  history.replaceState(null, '', location.pathname)
}

/** Volver atrás desde la sala de espera sin borrar el acceso rápido "Volver a la sala" */
export function disconnect() {
  closeSocket()
  useOnline.setState({ code: null, status: 'idle', room: null, you: null, error: null })
}

export const online = {
  addBot: (level: 'easy' | 'medium' | 'hard') => send({ t: 'addBot', level }),
  removeSeat: (seatId: string) => send({ t: 'removeSeat', seatId }),
  setTimer: (turnSeconds: number) => send({ t: 'settings', turnSeconds }),
  start: () => send({ t: 'start' }),
}
