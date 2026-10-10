import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { useGame } from '../store/gameStore'
import { loadGame } from '../store/persistence'
import { ActionButton } from './primitives'
import { Logo } from './Tile'

type BIPEvent = Event & { prompt: () => Promise<void> }
let deferred: BIPEvent | null = null
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent })

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export function HomeScreen() {
  const go = useGame((s) => s.go)
  const cont = useGame((s) => s.continueGame)
  const setRules = useGame((s) => s.setRules)
  const showToast = useGame((s) => s.showToast)
  const [saved] = useState(() => loadGame())
  const [canInstall, setCanInstall] = useState(false)
  const lastRoom = typeof localStorage !== 'undefined' ? localStorage.getItem('rumm5.lastRoom') : null

  useEffect(() => {
    setCanInstall(!standalone() && (!!deferred || isIOS()))
  }, [])

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-7 px-6 py-[calc(2rem+var(--safe-t))] land:flex-row land:gap-12">
      <div className="flex flex-col items-center gap-3">
        <Logo w={52} />
        <p className="text-sm text-ink/60">{t('app.tagline')}</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2.5">
        {saved && (
          <ActionButton variant="good" onClick={cont} className="w-full">▶ {t('home.continue')}</ActionButton>
        )}
        <ActionButton variant="primary" onClick={() => go('setup')} className="w-full">{t('home.new')}</ActionButton>
        <ActionButton onClick={() => go('online')} className="w-full">👥 {t('home.online')}</ActionButton>
        {lastRoom && (
          <ActionButton small onClick={() => { history.replaceState(null, '', `?sala=${lastRoom}`); go('online') }} className="w-full">
            {t('online.backToRoom', { code: lastRoom })}
          </ActionButton>
        )}
        <ActionButton small variant="ghost" onClick={() => setRules(true)} className="w-full">📖 {t('home.rules')}</ActionButton>
        {canInstall && (
          <ActionButton
            small
            variant="ghost"
            className="w-full text-sea"
            onClick={async () => {
              if (deferred) { await deferred.prompt(); deferred = null; setCanInstall(false) }
              else showToast(t('home.iosInstall'))
            }}
          >
            ⬇ {t('home.install')}
          </ActionButton>
        )}
      </div>
    </div>
  )
}
