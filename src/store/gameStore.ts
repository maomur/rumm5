import { create } from 'zustand'
import { setMuted, sfx } from '../audio/sfx'
import { decideBot } from '../engine/bot'
import { currentPlayer, playerById } from '../engine/queries'
import { applyAction, RuleError } from '../engine/reducer'
import { solve } from '../engine/solver'
import { createGame, type PlayerSetup } from '../engine/state'
import { analyzeMeld } from '../engine/tiles'
import type { Action, GameEvent, GameState, MoveTarget, Settings, TileId } from '../engine/types'
import { t } from '../i18n'
import { fly } from '../ui/fx'
import { loadGame, loadPrefs, saveGame, savePrefs } from './persistence'

// Ritmos (más lentos de lo que parece necesario: así se entiende lo que pasa)
export const OTHER_PLAY_MS = 1300
export const DRAW_MS = 800
export const PASS_MS = 1000
export const TURN_MS = 450
export const BOT_DELAY_MS = 1000
export const PENALTY_MS = 2600
export const FIRST_MELD_MS = 2200

export type Screen = 'home' | 'setup' | 'game' | 'online'

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'good' }
export interface Announce { kind: 'firstMeld' | 'penalty'; playerId: string; points?: number; count?: number }

interface Store {
  screen: Screen
  mode: 'local' | 'online'
  game: GameState | null
  mySeat: string | null
  viewerId: string | null
  selected: TileId[]
  sortMode: 'color' | 'number'
  muted: boolean
  queue: GameEvent[]
  busy: boolean
  toast: Toast | null
  announce: Announce | null
  showRoundOver: boolean
  passPhoneTo: string | null
  fresh: TileId[]
  hint: TileId[]
  glowMelds: number[]
  invalidMelds: number[]
  turnDeadline: number | null
  menuOpen: boolean
  rulesOpen: boolean
  /** envía la acción al servidor (modo online) */
  send: ((a: Action) => void) | null

  go(screen: Screen): void
  newLocalGame(players: PlayerSetup[], settings: Partial<Settings>): void
  continueGame(): void
  dispatch(a: Action): void
  applyRemote(game: GameState, events: GameEvent[], deadline: number | null): void
  toggleSelect(t: TileId): void
  clearSelection(): void
  moveSelectedTo(to: MoveTarget): void
  setSort(m: 'color' | 'number'): void
  toggleMute(): void
  showToast(text: string, kind?: Toast['kind']): void
  closeAnnounce(): void
  confirmPassPhone(): void
  nextRound(): void
  exitToMenu(): void
  askHint(): void
  setMenu(open: boolean): void
  setRules(open: boolean): void
  startOnline(seat: string, send: (a: Action) => void): void
}

const prefs = loadPrefs()
setMuted(prefs.muted)
let toastSeq = 0
let pumpTimer: ReturnType<typeof setTimeout> | null = null
let botTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
let announceTimer: ReturnType<typeof setTimeout> | null = null

export const useGame = create<Store>((set, get) => {
  const isLocal = (playerId: string) => {
    const { mode, mySeat, game } = get()
    if (mode === 'online') return playerId === mySeat
    return !!game && !playerById(game, playerId)?.isBot
  }
  const humanCount = () => get().game?.players.filter((p) => !p.isBot).length ?? 0
  const nameOf = (id: string) => get().game?.players.find((p) => p.id === id)?.name ?? '?'

  function enqueue(events: GameEvent[]) {
    if (!events.length) return
    set((s) => ({ queue: [...s.queue, ...events], busy: true }))
    if (!pumpTimer) pump()
  }

  function pump() {
    pumpTimer = null
    const s = get()
    if (s.announce || s.showRoundOver) return // un popup abierto pausa la cola
    const [ev, ...rest] = s.queue
    if (!ev) {
      set({ busy: false })
      scheduleBot()
      return
    }
    set({ queue: rest })
    const wait = handle(ev)
    pumpTimer = setTimeout(pump, wait)
  }

  function handle(ev: GameEvent): number {
    const s = get()
    const g = s.game!
    switch (ev.type) {
      case 'turnStart': {
        const local = isLocal(ev.playerId)
        const deadline = s.mode === 'local' && local && g.settings.turnSeconds > 0 ? Date.now() + g.settings.turnSeconds * 1000 : s.mode === 'online' ? s.turnDeadline : null
        set({ selected: [], hint: [], invalidMelds: [], turnDeadline: deadline })
        if (local) {
          if (s.mode === 'local' && humanCount() > 1 && s.viewerId !== ev.playerId) set({ passPhoneTo: ev.playerId })
          set({ viewerId: ev.playerId })
          sfx.yourTurn()
        }
        return TURN_MS
      }
      case 'draw': {
        const mine = isLocal(ev.playerId) && s.viewerId === ev.playerId
        if (mine) {
          set({ fresh: ev.tiles })
          setTimeout(() => set({ fresh: [] }), 2600)
        } else {
          fly('pool', `player-${ev.playerId}`, Math.min(ev.count, 3))
        }
        sfx.draw()
        if (ev.penalty) {
          sfx.penalty()
          set({ announce: { kind: 'penalty', playerId: ev.playerId, count: ev.count } })
          announceTimer = setTimeout(() => get().closeAnnounce(), PENALTY_MS)
          return PENALTY_MS
        }
        if (!mine) get().showToast(t('game.drew', { name: nameOf(ev.playerId) }))
        return DRAW_MS
      }
      case 'pass': {
        sfx.pass()
        get().showToast(t('game.passed', { name: nameOf(ev.playerId) }))
        return PASS_MS
      }
      case 'play': {
        const mine = isLocal(ev.playerId)
        set({ glowMelds: ev.meldIds })
        setTimeout(() => set({ glowMelds: [] }), 1800)
        if (mine) sfx.meldOk()
        else sfx.otherPlay()
        if (ev.firstMeld) {
          setTimeout(() => sfx.firstMeld(), 250)
          set({ announce: { kind: 'firstMeld', playerId: ev.playerId, points: ev.points } })
          announceTimer = setTimeout(() => get().closeAnnounce(), FIRST_MELD_MS)
          return FIRST_MELD_MS
        }
        if (!mine) get().showToast(t('game.played', { name: nameOf(ev.playerId), n: ev.tiles.length }))
        return mine ? 500 : OTHER_PLAY_MS
      }
      case 'rummy': {
        sfx.fanfare()
        return 900
      }
      case 'roundOver': {
        const won = isLocal(ev.winnerId)
        if (won || (s.mode === 'local' && humanCount() === 0)) sfx.victory()
        else sfx.lose()
        set({ showRoundOver: true, turnDeadline: null })
        return 0
      }
    }
    return 0
  }

  function scheduleBot() {
    if (botTimer) return
    const s = get()
    const g = s.game
    if (!g || s.mode !== 'local' || g.phase !== 'play' || s.busy || s.announce || s.passPhoneTo) return
    if (!currentPlayer(g).isBot) return
    botTimer = setTimeout(() => {
      botTimer = null
      const now = get()
      if (!now.game || now.busy || now.mode !== 'local' || !currentPlayer(now.game).isBot) return
      now.dispatch(decideBot(now.game))
    }, BOT_DELAY_MS)
  }

  function fail(e: unknown, a: Action) {
    if (e instanceof RuleError) {
      sfx.deny()
      get().showToast(t(e.reason, e.vars), 'error')
      if (a.type === 'endTurn' || a.type === 'timeout') {
        const g = get().game!
        const bad = g.draft.table.filter((m) => !analyzeMeld(m.tiles).valid).map((m) => m.id)
        set({ invalidMelds: bad })
      }
      return
    }
    throw e
  }

  function stop() {
    if (pumpTimer) clearTimeout(pumpTimer)
    if (botTimer) clearTimeout(botTimer)
    if (announceTimer) clearTimeout(announceTimer)
    pumpTimer = botTimer = announceTimer = null
  }

  const reset = {
    queue: [] as GameEvent[], busy: false, toast: null, announce: null, showRoundOver: false, passPhoneTo: null,
    fresh: [] as TileId[], hint: [] as TileId[], glowMelds: [] as number[], invalidMelds: [] as number[], selected: [] as TileId[], turnDeadline: null,
  }

  return {
    screen: 'home',
    mode: 'local',
    game: null,
    mySeat: null,
    viewerId: null,
    sortMode: prefs.sortMode,
    muted: prefs.muted,
    menuOpen: false,
    rulesOpen: false,
    send: null,
    ...reset,

    go: (screen) => set({ screen }),

    newLocalGame(players, settings) {
      stop()
      const game = createGame(players, (Math.random() * 2 ** 32) >>> 0, settings)
      const firstHuman = game.players.find((p) => !p.isBot)?.id ?? null
      const events = game.events
      set({ ...reset, game, mode: 'local', screen: 'game', viewerId: firstHuman, mySeat: null, send: null })
      saveGame(game)
      enqueue(events)
    },

    continueGame() {
      const game = loadGame()
      if (!game) return
      stop()
      const firstHuman = game.phase === 'play' && !currentPlayer(game).isBot ? currentPlayer(game).id : game.players.find((p) => !p.isBot)?.id ?? null
      set({ ...reset, game, mode: 'local', screen: 'game', viewerId: firstHuman, showRoundOver: game.phase === 'roundOver', mySeat: null, send: null })
      if (game.phase === 'play' && !currentPlayer(game).isBot && game.settings.turnSeconds > 0) set({ turnDeadline: Date.now() + game.settings.turnSeconds * 1000 })
      scheduleBot()
    },

    dispatch(a) {
      const s = get()
      if (!s.game) return
      const draftOnly = a.type === 'move' || a.type === 'undo' || a.type === 'reset'
      if (s.mode === 'online') {
        // los movimientos del borrador se aplican ya (optimista); el resto espera al servidor
        if (draftOnly) {
          try {
            const next = applyAction(s.game, a)
            set({ game: next, invalidMelds: [] })
          } catch (e) { fail(e, a); return }
        }
        s.send?.(a)
        if (a.type === 'move') sfx.place()
        if (a.type === 'undo' || a.type === 'reset') sfx.undo()
        return
      }
      try {
        const next = applyAction(s.game, a)
        set({ game: next, invalidMelds: a.type === 'move' ? s.invalidMelds.filter((id) => next.draft.table.some((m) => m.id === id && !analyzeMeld(m.tiles).valid)) : [] })
        saveGame(next)
        if (a.type === 'move') sfx.place()
        if (a.type === 'undo' || a.type === 'reset') sfx.undo()
        enqueue(next.events)
      } catch (e) {
        fail(e, a)
      }
    },

    applyRemote(game, events, deadline) {
      const prevViewer = get().viewerId
      set({ game, turnDeadline: deadline, viewerId: get().mySeat ?? prevViewer })
      enqueue(events)
    },

    toggleSelect(tile) {
      const s = get()
      if (s.selected.includes(tile)) set({ selected: s.selected.filter((x) => x !== tile) })
      else { set({ selected: [...s.selected, tile] }); sfx.pick() }
    },
    clearSelection: () => set({ selected: [] }),

    moveSelectedTo(to) {
      const s = get()
      if (!s.game || !s.viewerId) return
      if (!s.selected.length) { sfx.deny(); get().showToast(t('err.noTiles'), 'error'); return }
      const tiles = s.selected
      set({ selected: [] })
      get().dispatch({ type: 'move', playerId: s.viewerId, tiles, to })
    },

    setSort(m) { set({ sortMode: m }); savePrefs({ sortMode: m }) },
    toggleMute() { const m = !get().muted; setMuted(m); set({ muted: m }); savePrefs({ muted: m }); if (!m) sfx.button() },

    showToast(text, kind = 'info') {
      if (toastTimer) clearTimeout(toastTimer)
      set({ toast: { id: ++toastSeq, text, kind } })
      toastTimer = setTimeout(() => set({ toast: null }), kind === 'error' ? 3200 : 2200)
    },

    closeAnnounce() {
      if (announceTimer) clearTimeout(announceTimer)
      announceTimer = null
      set({ announce: null })
      if (!pumpTimer) pumpTimer = setTimeout(pump, 150)
    },

    confirmPassPhone() { set({ passPhoneTo: null }); scheduleBot() },

    nextRound() {
      const s = get()
      if (!s.game) return
      set({ showRoundOver: false })
      if (s.mode === 'online') { s.send?.({ type: 'nextRound', playerId: s.mySeat! }); return }
      get().dispatch({ type: 'nextRound', playerId: s.game.players[0].id })
    },

    exitToMenu() {
      stop()
      const s = get()
      if (s.mode === 'local') saveGame(s.game?.phase === 'play' || s.game?.phase === 'roundOver' ? s.game : null)
      else {
        void import('../online/client').then((m) => m.disconnect())
        history.replaceState(null, '', location.pathname)
      }
      set({ ...reset, screen: 'home', menuOpen: false, game: s.mode === 'local' ? s.game : null, send: null })
    },

    askHint() {
      const s = get()
      const g = s.game
      if (!g || !s.viewerId || currentPlayer(g).id !== s.viewerId) return
      const p = currentPlayer(g)
      const res = p.hasMelded ? solve(g.table.flatMap((m) => m.tiles), p.rack, 20000) : solve([], p.rack, 20000)
      let tiles = res?.used ?? []
      if (!p.hasMelded && res) {
        const pts = res.melds.reduce((a, m) => { const x = analyzeMeld(m); return a + (x.valid ? x.points : 0) }, 0)
        if (pts < g.settings.initialMeld) tiles = []
      }
      if (!tiles.length) { get().showToast(t('game.noHint')); sfx.deny(); return }
      sfx.meldOk()
      set({ hint: tiles })
      setTimeout(() => set({ hint: [] }), 3500)
    },

    setMenu: (open) => set({ menuOpen: open }),
    setRules: (open) => set({ rulesOpen: open }),

    startOnline(seat, send) {
      stop()
      set({ ...reset, mode: 'online', mySeat: seat, viewerId: seat, send, screen: 'game' })
    },
  }
})

/** Para el temporizador: el jugador local agota el tiempo */
export function fireTimeout() {
  const s = useGame.getState()
  const g = s.game
  if (!g || g.phase !== 'play' || s.mode !== 'local') return
  const p = currentPlayer(g)
  if (p.isBot) return
  s.dispatch({ type: 'timeout', playerId: p.id })
}
