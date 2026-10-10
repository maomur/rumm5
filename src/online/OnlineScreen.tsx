import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { useGame } from '../store/gameStore'
import { loadPrefs, savePrefs } from '../store/persistence'
import { ActionButton, Avatar } from '../ui/primitives'
import { connect, disconnect, online, useOnline } from './client'
import { newRoomCode } from './identity'

const TIMERS = [0, 60, 90, 120]

export default function OnlineScreen() {
  const go = useGame((s) => s.go)
  const showToast = useGame((s) => s.showToast)
  const { code, status, room, you, error } = useOnline()
  const [name, setName] = useState(() => loadPrefs().name || '')
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(location.search).get('sala')?.toUpperCase() ?? '')

  useEffect(() => {
    // si venimos con ?sala= y ya tenemos nombre, entramos directos
    const fromLink = new URLSearchParams(location.search).get('sala')
    if (fromLink && loadPrefs().name && !code) connect(fromLink.toUpperCase(), loadPrefs().name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enter = (c: string) => {
    const n = name.trim() || 'Jugador'
    savePrefs({ name: n })
    history.replaceState(null, '', `?sala=${c}`)
    connect(c, n)
  }
  const back = () => {
    disconnect()
    history.replaceState(null, '', location.pathname)
    go('home')
  }

  const header = (
    <div className="flex items-center gap-3">
      <button type="button" onClick={back} className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory text-xl ring-1 ring-line" aria-label="Volver">←</button>
      <h1 className="font-display text-2xl font-semibold">{room ? t('online.room', { code: room.code }) : t('online.title')}</h1>
    </div>
  )

  if (!code) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-[calc(1rem+var(--safe-t))]">
        {header}
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
          {t('online.yourName')}
          <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} className="rounded-2xl bg-ivory px-4 py-3 font-display text-lg text-ink ring-1 ring-line outline-none focus:ring-sea" />
        </label>
        <ActionButton variant="primary" onClick={() => enter(newRoomCode())}>{t('online.create')}</ActionButton>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder={t('online.code')}
            className="min-w-0 flex-1 rounded-2xl bg-ivory px-4 py-3 font-display text-lg tracking-widest uppercase ring-1 ring-line outline-none focus:ring-sea"
          />
          <ActionButton onClick={() => joinCode.length >= 4 && enter(joinCode)}>{t('online.join')}</ActionButton>
        </div>
      </div>
    )
  }

  const me = room?.seats.find((s) => s.id === you)
  const isHost = !!me?.host
  const link = `${location.origin}${location.pathname}?sala=${code}`

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-[calc(1rem+var(--safe-t))] land:max-w-2xl">
      {header}
      {status !== 'open' && <p className="text-sm text-ink/60">{t('online.connecting')}</p>}
      {error && <p className="rounded-2xl bg-terra/10 px-4 py-2 text-sm font-semibold text-terra">{t(error)}</p>}
      <ActionButton
        small
        ignoreBusy
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title: 'Rumm5', text: `¿Una partida de Rumm5? Sala ${code}`, url: link })
            else { await navigator.clipboard.writeText(link); showToast(t('online.copied'), 'good') }
          } catch { /* cancelado */ }
        }}
      >
        🔗 {t('online.share')} · <span className="tracking-widest">{code}</span>
      </ActionButton>

      <div className="grid gap-2 land:grid-cols-2">
        {room?.seats.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 rounded-2xl bg-ivory p-2.5 ring-1 ring-line">
            <Avatar index={i} size={34} dim={!s.connected} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display font-semibold">{s.isBot ? '🤖 ' : ''}{s.name}{s.id === you ? ` (${t('online.you')})` : ''}</div>
              <div className="text-xs text-ink/55">
                {s.host ? t('online.host') : s.isBot ? t(`level.${s.botLevel}`) : ''}{!s.connected ? ` · ${t('online.offline')}` : ''}
              </div>
            </div>
            {isHost && !room.started && !s.host && (
              <button type="button" onClick={() => online.removeSeat(s.id)} className="px-2 text-sm text-terra">{t('online.kick')}</button>
            )}
          </div>
        ))}
        {room && room.seats.length < 2 && <p className="text-sm text-ink/55">{t('online.waiting')}</p>}
      </div>

      {isHost && room && !room.started && (
        <>
          {room.seats.length < 4 && (
            <div className="flex flex-wrap gap-1.5">
              {(['easy', 'medium', 'hard'] as const).map((l) => (
                <ActionButton key={l} small ignoreBusy onClick={() => online.addBot(l)}>+ 🤖 {t(`level.${l}`)}</ActionButton>
              ))}
            </div>
          )}
          <div>
            <div className="mb-1.5 text-sm font-semibold text-ink/70">{t('setup.timer')}</div>
            <div className="flex flex-wrap gap-1.5">
              {TIMERS.map((s) => (
                <button key={s} type="button" onClick={() => online.setTimer(s)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${room.turnSeconds === s ? 'bg-sea text-white' : 'bg-sand text-ink/70 ring-1 ring-line'}`}>
                  {s === 0 ? t('setup.timerOff') : `${s} s`}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {room && !room.started && (
        <ActionButton
          variant="good"
          ignoreBusy
          className="mt-auto w-full"
          check={!isHost ? { ok: false, reason: 'online.onlyHost' } : room.seats.length < 2 ? { ok: false, reason: 'online.needTwo' } : undefined}
          onClick={online.start}
        >
          {t('online.start')}
        </ActionButton>
      )}
    </div>
  )
}
