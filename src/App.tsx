import { lazy, Suspense, useEffect } from 'react'
import { useGame } from './store/gameStore'
import { GameScreen } from './ui/GameScreen'
import { HomeScreen } from './ui/HomeScreen'
import { AnnounceView, MenuSheet, PassPhone, RoundOverModal, RulesSheet, ToastView } from './ui/Overlays'
import { SetupScreen } from './ui/SetupScreen'
import { Splash } from './ui/Splash'

const OnlineScreen = lazy(() => import('./online/OnlineScreen'))

export default function App() {
  const screen = useGame((s) => s.screen)
  const go = useGame((s) => s.go)

  useEffect(() => {
    // enlace de invitación: ?sala=CODIGO
    if (new URLSearchParams(location.search).get('sala')) go('online')
  }, [go])

  return (
    <>
      {screen === 'home' && <HomeScreen />}
      {screen === 'setup' && <SetupScreen />}
      {screen === 'game' && <GameScreen />}
      {screen === 'online' && (
        <Suspense fallback={null}>
          <OnlineScreen />
        </Suspense>
      )}
      <AnnounceView />
      <RoundOverModal />
      <PassPhone />
      <MenuSheet />
      <RulesSheet />
      <ToastView />
      <Splash />
    </>
  )
}
