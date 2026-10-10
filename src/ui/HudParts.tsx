import { useEffect, useRef, useState } from 'react'
import { sfx } from '../audio/sfx'
import { currentPlayer, draftChanged, placedFromRack } from '../engine/queries'
import { canDraw, canEndTurn, canReset, canUndo } from '../engine/validate'
import { t } from '../i18n'
import { fireTimeout, useGame } from '../store/gameStore'
import { ActionButton, Avatar } from './primitives'

export function TopBar() {
  const game = useGame((s) => s.game)!
  const muted = useGame((s) => s.muted)
  const toggleMute = useGame((s) => s.toggleMute)
  const setMenu = useGame((s) => s.setMenu)
  return (
    <div className="flex items-center gap-2 px-3 pt-[calc(0.4rem+var(--safe-t))] pb-1 land:px-2 land:pt-1.5">
      <button type="button" onClick={() => setMenu(true)} className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ivory text-lg ring-1 ring-line" aria-label={t('menu.title')}>
        ☰
      </button>
      <div className="min-w-0 font-display text-lg font-semibold max-[359px]:hidden land:hidden">Rumm5</div>
      <div className="text-xs text-ink/55 land:hidden">{t('game.round', { n: game.round })}</div>
      <div id="pool" className="ml-auto flex items-center gap-1.5 rounded-full bg-ivory px-2.5 py-1 text-xs font-semibold ring-1 ring-line">
        <span className="inline-block h-3.5 w-2.5 rounded-[3px] bg-sea" />
        {game.pool.length}
      </div>
      <TurnTimer />
      <button type="button" onClick={toggleMute} className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ivory ring-1 ring-line" aria-label={t('menu.sound')}>
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  )
}

function TurnTimer() {
  const deadline = useGame((s) => s.turnDeadline)
  const mode = useGame((s) => s.mode)
  const [now, setNow] = useState(Date.now())
  const fired = useRef<number | null>(null)
  useEffect(() => {
    if (!deadline) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [deadline])
  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null
  useEffect(() => {
    if (left === null || !deadline) return
    if (left <= 5 && left > 0) sfx.tickTock()
    if (left === 0 && mode === 'local' && fired.current !== deadline) {
      fired.current = deadline
      fireTimeout()
    }
  }, [left, deadline, mode])
  if (left === null) return null
  return (
    <div className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ${left <= 10 ? 'bg-terra text-white ring-terra' : 'bg-ivory ring-line'}`}>
      ⏱ {t('game.timeLeft', { s: left })}
    </div>
  )
}

export function PlayersBar() {
  const game = useGame((s) => s.game)!
  const mySeat = useGame((s) => s.mySeat)
  const viewerId = useGame((s) => s.viewerId)
  const cur = game.phase === 'play' ? currentPlayer(game) : null
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 [scrollbar-width:none] land:flex-col land:gap-1 land:overflow-visible land:px-0">
      {game.players.map((p) => {
        const active = cur?.id === p.id
        const tiles = active ? game.draft.rack.length : p.rack.length
        const me = p.id === (mySeat ?? viewerId)
        return (
          <div
            key={p.id}
            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-2xl px-1.5 py-1 transition-all max-[380px]:gap-1 max-[380px]:px-1 land:py-0.5 ${active ? 'bg-ivory shadow-md ring-2 ring-sea' : 'bg-ivory/50 ring-1 ring-line/60'} basis-0 land:flex-none land:basis-auto`}
          >
            <div id={`player-${p.id}`} className="relative flex-none">
              <Avatar index={p.avatar} size={26} />
              {active && p.isBot && <span className="absolute -right-1 -bottom-1 rounded-full bg-ivory px-1 text-[10px] leading-4 ring-1 ring-line">…</span>}
            </div>
            <div className="min-w-0 leading-tight land:flex land:flex-1 land:items-center land:justify-between land:gap-1">
              <div className="truncate font-display text-[13px] font-semibold max-[380px]:text-[12px]">{p.name}{me && mySeat ? ' ·' : ''}</div>
              <div className="flex gap-1.5 text-[11px] text-ink/55">
                <span>▮{tiles}</span>
                <span className={`max-[380px]:hidden land:inline ${p.total < 0 ? 'text-terra' : p.total > 0 ? 'text-good' : ''}`}>{p.total > 0 ? '+' : ''}{p.total}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ActionBar({ vertical = false }: { vertical?: boolean }) {
  const game = useGame((s) => s.game)!
  const viewerId = useGame((s) => s.viewerId)
  const dispatch = useGame((s) => s.dispatch)
  const askHint = useGame((s) => s.askHint)
  const clear = useGame((s) => s.clearSelection)
  const cur = game.phase === 'play' ? currentPlayer(game) : null
  const myTurn = !!cur && cur.id === viewerId

  if (!myTurn) {
    return (
      <div className={`flex items-center justify-center px-3 py-2 text-sm text-ink/55 ${vertical ? 'min-h-0 flex-1 text-center' : 'min-h-[52px]'}`}>
        {cur ? (cur.isBot ? t('game.thinking', { name: cur.name }) : t('game.turnOf', { name: cur.name })) : ''}
      </div>
    )
  }
  const id = viewerId!
  const played = draftChanged(game) && placedFromRack(game).length > 0
  const poolEmpty = game.pool.length === 0
  const act = (type: 'undo' | 'reset' | 'draw' | 'endTurn') => () => { if (type !== 'undo') clear(); dispatch({ type, playerId: id }) }

  return (
    <div className={vertical ? 'flex flex-col gap-1.5' : 'flex items-center gap-1.5 px-3 py-1.5'}>
      <div className="flex min-w-0 gap-1.5">
        <ActionButton small onClick={act('undo')} check={canUndo(game, id)} className="flex-1 !px-2.5" >↶<span className={`ml-1 max-[380px]:hidden land:hidden ${played ? 'hidden' : ''}`}>{t('game.undo')}</span></ActionButton>
        <ActionButton small onClick={act('reset')} check={canReset(game, id)} className="flex-1 !px-2.5">⟲<span className={`ml-1 max-[380px]:hidden land:hidden ${played ? 'hidden' : ''}`}>{t('game.reset')}</span></ActionButton>
        <ActionButton small onClick={askHint} className="flex-1 !px-2.5" ignoreBusy>💡</ActionButton>
      </div>
      <div className={`flex gap-1.5 ${vertical ? 'flex-col' : 'ml-auto'}`}>
        <ActionButton onClick={act('draw')} check={canDraw(game, id)} variant={played ? 'secondary' : 'primary'} className="!px-3.5">
          {poolEmpty ? t('game.pass') : t('game.draw')}
        </ActionButton>
        {(played || vertical) && (
          <ActionButton onClick={act('endTurn')} variant="good" className={`!px-3.5 ${canEndTurn(game, id).ok ? '' : 'opacity-60'}`}>
            {t('game.endTurn')} ✓
          </ActionButton>
        )}
      </div>
    </div>
  )
}
