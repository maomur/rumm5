import { describe, expect, it } from 'vitest'
import { animationBudgetMs, RoomLogic } from '../../src/online/roomLogic'

describe('sala online', () => {
  it('anfitrión, invitados, bots y empezar', () => {
    const r = RoomLogic.create('ABCDE')
    r.handle('k1', { t: 'hello', key: 'k1', name: 'Mauri' }, 0)
    r.handle('k2', { t: 'hello', key: 'k2', name: 'Ana' }, 0)
    expect(r.handle('k2', { t: 'start' }, 0).error?.reason).toBe('online.onlyHost')
    r.handle('k1', { t: 'addBot', level: 'hard' }, 0)
    const v = r.view('x')
    expect(v.seats).toHaveLength(3)
    expect(v.seats[0].host).toBe(true)
    const res = r.handle('k1', { t: 'start' }, 0)
    expect(res.state).toBeTruthy()
    expect(r.room.game!.players.map((p) => p.name)).toEqual(['Mauri', 'Ana', 'Lola'])
    expect(r.handle('k3', { t: 'hello', key: 'k3', name: 'Tarde' }, 0).error?.reason).toBe('online.started')
  })
  it('solo actúa a quien le toca', () => {
    const r = RoomLogic.create('X')
    r.handle('k1', { t: 'hello', key: 'k1', name: 'A' }, 0)
    r.handle('k2', { t: 'hello', key: 'k2', name: 'B' }, 0)
    r.handle('k1', { t: 'start' }, 0)
    expect(r.handle('k2', { t: 'action', action: { type: 'draw', playerId: 's2' }, seq: 1 }, 0).error?.reason).toBe('err.notYourTurn')
    // aunque mienta en playerId, actúa con su asiento
    const ok = r.handle('k1', { t: 'action', action: { type: 'draw', playerId: 's2' }, seq: 1 }, 0)
    expect(ok.state).toBeTruthy()
    expect(r.room.game!.current).toBe(1)
  })
  it('reconectar recupera el asiento', () => {
    const r = RoomLogic.create('X')
    r.handle('k1', { t: 'hello', key: 'k1', name: 'A' }, 0)
    r.connect('k1', false, 100)
    r.handle('k1', { t: 'hello', key: 'k1', name: 'A2' }, 200)
    expect(r.room.seats).toHaveLength(1)
    expect(r.room.seats[0].connected).toBe(true)
  })
  it('bots y ausentes juegan solos hasta terminar', () => {
    const r = RoomLogic.create('X')
    r.handle('k1', { t: 'hello', key: 'k1', name: 'A' }, 0)
    r.handle('k1', { t: 'addBot', level: 'medium' }, 0)
    r.handle('k1', { t: 'addBot', level: 'easy' }, 0)
    r.handle('k1', { t: 'start' }, 0)
    r.connect('k1', false, 0)
    let now = 0
    for (let i = 0; i < 1000 && r.room.game!.phase === 'play'; i++) {
      const next = r.pendingAutoActor(now)!
      expect(next).toBeTruthy()
      now = Math.max(now, next.at)
      const res = r.runAuto(next.kind, now)
      expect(res.error).toBeUndefined()
    }
    expect(r.room.game!.phase).toBe('roundOver')
  })
  it('tiempo por turno', () => {
    const r = RoomLogic.create('X')
    r.handle('k1', { t: 'hello', key: 'k1', name: 'A' }, 0)
    r.handle('k2', { t: 'hello', key: 'k2', name: 'B' }, 0)
    r.handle('k1', { t: 'settings', turnSeconds: 60 }, 0)
    r.handle('k1', { t: 'start' }, 1000)
    const next = r.pendingAutoActor(1000)
    expect(next?.kind).toBe('timeout')
    expect(next!.at).toBeGreaterThanOrEqual(61000)
    r.runAuto('timeout', next!.at)
    expect(r.room.game!.current).toBe(1)
  })
  it('presupuesto de animación', () => {
    expect(animationBudgetMs([{ type: 'turnStart', playerId: 'a' }, { type: 'draw', playerId: 'a', count: 1, tiles: [1] }])).toBe(1750)
  })
})
