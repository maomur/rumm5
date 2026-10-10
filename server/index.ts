import { routePartykitRequest, Server, type Connection, type WSMessage } from 'partyserver'
import { animationBudgetMs, RoomLogic, type HandleResult, type Room } from '../src/online/roomLogic'
import type { ClientMsg, ServerMsg } from '../src/online/protocol'

const VERSION = 'v3 · 2026-10-10'
const BOT_DELAY_MS = 1700
const BOT_STEP_MS = 1300

interface Env {
  GameRoom: DurableObjectNamespace
}

export class GameRoom extends Server<Env> {
  // sin hibernar: si no, mueren los temporizadores de los bots
  static options = { hibernate: false }

  logic!: RoomLogic
  timer: ReturnType<typeof setTimeout> | null = null
  lastBudget = 0

  async onStart() {
    const saved = await this.ctx.storage.get<Room>('room')
    this.logic = saved ? new RoomLogic(saved) : RoomLogic.create(this.name)
    this.schedule()
  }

  onConnect(conn: Connection) {
    conn.setState({ key: null })
  }

  async onMessage(conn: Connection, raw: WSMessage) {
    let msg: ClientMsg
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return
    }
    if (msg.t === 'hello') conn.setState({ key: msg.key })
    const key = (conn.state as { key: string | null } | null)?.key
    if (!key) return
    const res = this.logic.handle(key, msg, Date.now())
    if (res.error) {
      this.sendTo(conn, { t: 'error', ...res.error, seq: msg.t === 'action' ? msg.seq : undefined })
    }
    if (msg.t === 'hello') {
      // al entrar recibe la sala y, si ya hay partida, el estado actual
      this.broadcastRoom()
      const g = this.logic.room.game
      if (g) this.sendTo(conn, { t: 'state', game: g, events: [], deadline: this.logic.room.deadline, by: null, seq: null })
      await this.persist()
      this.schedule()
      return
    }
    await this.after(res)
  }

  async onClose(conn: Connection) {
    const key = (conn.state as { key: string | null } | null)?.key
    if (!key) return
    // ¿sigue conectado desde otra pestaña?
    for (const c of this.getConnections()) if (c !== conn && (c.state as { key: string } | null)?.key === key) return
    if (this.logic.connect(key, false, Date.now())) {
      this.broadcastRoom()
      await this.persist()
      this.schedule()
    }
  }

  private async after(res: HandleResult) {
    if (res.room) this.broadcastRoom()
    if (res.state) {
      const g = this.logic.room.game!
      this.broadcast(JSON.stringify({ t: 'state', game: g, events: res.state.events, deadline: this.logic.room.deadline, by: res.state.by, seq: res.state.seq } satisfies ServerMsg))
      this.lastBudget = animationBudgetMs(res.state.events)
    }
    if (res.room || res.state) await this.persist()
    this.schedule()
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const now = Date.now()
    const next = this.logic.pendingAutoActor(now)
    if (!next) return
    const wait = next.kind === 'step' ? BOT_STEP_MS : next.kind === 'bot' ? this.lastBudget + BOT_DELAY_MS : Math.max(0, next.at - now)
    this.timer = setTimeout(async () => {
      this.timer = null
      this.lastBudget = 0
      const again = this.logic.pendingAutoActor(Date.now())
      if (!again || again.kind !== next.kind) return this.schedule()
      await this.after(this.logic.runAuto(again.kind, Date.now()))
    }, wait)
  }

  private broadcastRoom() {
    const view = this.logic.view(VERSION)
    for (const c of this.getConnections()) {
      const key = (c.state as { key: string | null } | null)?.key
      this.sendTo(c, { t: 'room', room: view, you: key ? this.logic.seatOf(key)?.id ?? null : null })
    }
  }

  private sendTo(c: Connection, m: ServerMsg) {
    c.send(JSON.stringify(m))
  }

  private async persist() {
    await this.ctx.storage.put('room', this.logic.room)
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/') return new Response(`Rumm5 online: OK (${VERSION})`, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    return (await routePartykitRequest(req, env as unknown as Record<string, unknown>)) ?? new Response('No encontrado', { status: 404 })
  },
}
