import { useEffect } from 'react'
import { sfx, SOUND_LIST } from '../audio/sfx'
import { playerById } from '../engine/queries'
import { t } from '../i18n'
import { useGame } from '../store/gameStore'
import { confetti } from './fx'
import { ActionButton, Avatar, Popup, Sheet } from './primitives'
import { FaceTile } from './Tile'

export function ToastView() {
  const toast = useGame((s) => s.toast)
  if (!toast) return null
  const color = toast.kind === 'error' ? 'bg-terra text-white' : toast.kind === 'good' ? 'bg-good text-white' : 'bg-ink text-sand'
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(7.4rem+var(--safe-t))] z-[60] flex justify-center px-4 land:top-2">
      <div key={toast.id} className={`max-w-sm rounded-2xl px-4 py-2.5 text-center text-sm font-semibold shadow-lg ${color}`} style={{ animation: 'pop-in .22s cubic-bezier(.2,.9,.3,1.3)' }}>
        {toast.text}
      </div>
    </div>
  )
}

export function AnnounceView() {
  const a = useGame((s) => s.announce)
  const game = useGame((s) => s.game)
  const viewerId = useGame((s) => s.viewerId)
  const close = useGame((s) => s.closeAnnounce)
  if (!a || !game) return null
  const p = playerById(game, a.playerId)
  if (!p) return null
  const you = a.playerId === viewerId
  return (
    <Popup origin={`player-${p.id}`} onClose={close}>
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar index={p.avatar} size={48} />
        {a.kind === 'firstMeld' ? (
          <>
            <div className="font-display text-4xl font-bold text-sea">{a.points}</div>
            <p className="font-display text-lg font-semibold">
              {you ? t('game.firstMeldYou', { points: a.points! }) : t('game.firstMeld', { name: p.name, points: a.points! })}
            </p>
          </>
        ) : (
          <>
            <div className="flex gap-1">{Array.from({ length: a.count ?? 3 }, (_, i) => <div key={i} className="tile-back" />)}</div>
            <p className="font-display text-lg font-semibold">{t('game.penalty', { name: you ? 'tú' : p.name, n: a.count! })}</p>
          </>
        )}
        <ActionButton variant="primary" ignoreBusy onClick={close} className="mt-1 w-full">OK</ActionButton>
      </div>
    </Popup>
  )
}

export function RoundOverModal() {
  const show = useGame((s) => s.showRoundOver)
  const game = useGame((s) => s.game)
  const mode = useGame((s) => s.mode)
  const mySeat = useGame((s) => s.mySeat)
  const viewerId = useGame((s) => s.viewerId)
  const next = useGame((s) => s.nextRound)
  const exit = useGame((s) => s.exitToMenu)
  useEffect(() => {
    if (show) confetti()
  }, [show])
  if (!show || !game || !game.winnerId || !game.lastScores) return null
  const winner = playerById(game, game.winnerId)!
  const you = winner.id === (mySeat ?? viewerId)
  const blocked = game.players.find((p) => p.id === winner.id)!.rack.length > 0
  const isHost = mode === 'local' || game.players[0].id === mySeat
  const rows = [...game.players].sort((a, b) => b.total - a.total)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 animate-fade">
      <div className="w-full max-w-sm land:max-w-xl rounded-3xl bg-ivory p-5 land:p-4 shadow-2xl" style={{ animation: 'pop-in .45s cubic-bezier(.2,.9,.3,1.25)' }}>
        <div className="flex flex-col items-center gap-2 text-center land:flex-row land:items-start land:gap-5 land:text-left">
          <div className="flex flex-col items-center gap-2 land:w-44 land:flex-none">
            <div className="flex gap-1" style={{ transform: 'rotate(-3deg)' }}>
              <FaceTile label="!" color={1} w={34} />
              <Avatar index={winner.avatar} size={46} />
              <FaceTile label="5" color={2} w={34} />
            </div>
            <h2 className="font-display text-3xl font-bold text-terra">{t('round.win')}</h2>
            <p className="font-display text-lg font-semibold">{you ? t('round.youWin') : t('round.winner', { name: winner.name })}</p>
            {blocked && <p className="text-xs text-ink/55">{t('round.blocked')}</p>}
          </div>
          <div className="w-full">
            <table className="mt-2 w-full text-sm land:mt-0">
              <thead>
                <tr className="text-xs text-ink/50">
                  <th className="text-left font-normal" />
                  <th className="text-right font-normal">{t('round.points')}</th>
                  <th className="text-right font-normal">{t('round.total')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const pts = game.lastScores![p.id] ?? 0
                  return (
                    <tr key={p.id} className="border-t border-line/60">
                      <td className="flex items-center gap-2 py-1.5"><Avatar index={p.avatar} size={22} /><span className="truncate font-semibold">{p.name}</span></td>
                      <td className={`text-right tabular-nums ${pts > 0 ? 'text-good' : pts < 0 ? 'text-terra' : ''}`}>{pts > 0 ? '+' : ''}{pts}</td>
                      <td className="text-right font-bold tabular-nums">{p.total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-4 flex gap-2 land:mt-3">
              <ActionButton ignoreBusy onClick={exit} className="flex-1">{t('round.menu')}</ActionButton>
              {isHost && <ActionButton ignoreBusy variant="primary" onClick={next} className="flex-1">{t('round.next')}</ActionButton>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PassPhone() {
  const to = useGame((s) => s.passPhoneTo)
  const game = useGame((s) => s.game)
  const confirm = useGame((s) => s.confirmPassPhone)
  if (!to || !game) return null
  const p = playerById(game, to)!
  return (
    <div className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-5 bg-sea p-6 text-center text-white animate-fade">
      <Avatar index={p.avatar} size={72} />
      <h2 className="font-display text-2xl font-semibold">{t('game.passPhone', { name: p.name })}</h2>
      <button type="button" onClick={() => { sfx.button(); confirm() }} className="rounded-2xl bg-ivory px-6 py-3 font-display font-semibold text-sea shadow-lg">
        {t('game.passPhoneGo', { name: p.name })}
      </button>
    </div>
  )
}

export function MenuSheet() {
  const open = useGame((s) => s.menuOpen)
  const setMenu = useGame((s) => s.setMenu)
  const muted = useGame((s) => s.muted)
  const toggleMute = useGame((s) => s.toggleMute)
  const setRules = useGame((s) => s.setRules)
  const exit = useGame((s) => s.exitToMenu)
  const mode = useGame((s) => s.mode)
  if (!open) return null
  return (
    <Sheet title={t('menu.title')} onClose={() => setMenu(false)}>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={toggleMute} className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3 font-semibold">
          <span>{muted ? '🔇' : '🔊'} {t('menu.sound')}</span>
          <span className="text-sm text-ink/60">{muted ? t('menu.off') : t('menu.on')}</span>
        </button>
        <details className="rounded-2xl bg-sand px-4 py-3">
          <summary className="font-semibold">🎵 {t('menu.testSounds')}</summary>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {SOUND_LIST.map((s) => (
              <button key={s.key} type="button" onClick={() => sfx[s.key]()} className="rounded-xl bg-ivory px-2 py-2 text-left text-sm ring-1 ring-line">
                ▶ {s.label}
              </button>
            ))}
          </div>
        </details>
        <button type="button" onClick={() => { setMenu(false); setRules(true) }} className="rounded-2xl bg-sand px-4 py-3 text-left font-semibold">
          📖 {t('menu.rules')}
        </button>
        <button type="button" onClick={exit} className="rounded-2xl bg-sand px-4 py-3 text-left font-semibold text-terra">
          ← {mode === 'online' ? t('menu.leaveRoom') : t('menu.exit')}
        </button>
      </div>
    </Sheet>
  )
}

export function RulesSheet() {
  const open = useGame((s) => s.rulesOpen)
  const setRules = useGame((s) => s.setRules)
  if (!open) return null
  return (
    <Sheet title={t('rules.title')} onClose={() => setRules(false)}>
      <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{t('rules.body')}</div>
    </Sheet>
  )
}
