import { useState } from 'react'
import type { BotLevel } from '../engine/types'
import { t } from '../i18n'
import { useGame } from '../store/gameStore'
import { loadPrefs, savePrefs } from '../store/persistence'
import { ActionButton, Avatar } from './primitives'

interface Row { name: string; isBot: boolean; botLevel: BotLevel }

const BOT_NAMES = ['Lola', 'Pau', 'Nuria', 'Jordi', 'Marta', 'Iker']
const TIMERS = [0, 60, 90, 120]

export function SetupScreen() {
  const go = useGame((s) => s.go)
  const start = useGame((s) => s.newLocalGame)
  const [rows, setRows] = useState<Row[]>(() => [
    { name: loadPrefs().name || 'Yo', isBot: false, botLevel: 'medium' },
    { name: BOT_NAMES[0], isBot: true, botLevel: 'medium' },
    { name: BOT_NAMES[1], isBot: true, botLevel: 'medium' },
  ])
  const [timer, setTimer] = useState(0)

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-[calc(1rem+var(--safe-t))] land:max-w-2xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => go('home')} className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory text-xl ring-1 ring-line" aria-label="Volver">←</button>
        <h1 className="font-display text-2xl font-semibold">{t('setup.title')}</h1>
      </div>

      <div className="grid gap-2 land:grid-cols-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-2xl bg-ivory p-2 ring-1 ring-line">
            <Avatar index={i} size={34} />
            <div className="min-w-0 flex-1">
              <input
                value={r.name}
                maxLength={12}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder={t('setup.namePh')}
                className="w-full rounded-lg bg-transparent px-1 font-display text-base font-semibold outline-none focus:bg-sand"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                <Chip on={!r.isBot} onClick={() => update(i, { isBot: false })}>{t('setup.human')}</Chip>
                {(['easy', 'medium', 'hard'] as BotLevel[]).map((l) => (
                  <Chip key={l} on={r.isBot && r.botLevel === l} onClick={() => update(i, { isBot: true, botLevel: l })}>🤖 {t(`level.${l}`)}</Chip>
                ))}
              </div>
            </div>
            {rows.length > 2 && (
              <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="px-2 text-xl text-ink/40" aria-label="Quitar">×</button>
            )}
          </div>
        ))}
      </div>
      {rows.length < 4 && (
        <ActionButton small onClick={() => setRows((x) => [...x, { name: BOT_NAMES[x.length] ?? `Bot ${x.length}`, isBot: true, botLevel: 'medium' }])}>
          + {t('setup.add')}
        </ActionButton>
      )}

      <div>
        <div className="mb-1.5 text-sm font-semibold text-ink/70">{t('setup.timer')}</div>
        <div className="flex flex-wrap gap-1.5">
          {TIMERS.map((s) => (
            <Chip key={s} on={timer === s} onClick={() => setTimer(s)}>{s === 0 ? t('setup.timerOff') : `${s} s`}</Chip>
          ))}
        </div>
      </div>

      <ActionButton
        variant="good"
        className="mt-auto w-full"
        onClick={() => {
          const human = rows.find((r) => !r.isBot)
          if (human) savePrefs({ name: human.name.trim() })
          start(rows.map((r, i) => ({ name: r.name.trim() || `J${i + 1}`, isBot: r.isBot, botLevel: r.botLevel })), { turnSeconds: timer })
        }}
      >
        {t('setup.start')}
      </ActionButton>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${on ? 'bg-sea text-white' : 'bg-sand text-ink/70 ring-1 ring-line'}`}
    >
      {children}
    </button>
  )
}
