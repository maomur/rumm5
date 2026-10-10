import { useEffect, useRef } from 'react'
import { useGame } from '../store/gameStore'
import { ActionBar, PlayersBar, TopBar } from './HudParts'
import { RackView } from './RackView'
import { TableView } from './TableView'
import { resetFlip, useFlip } from './useFlip'

export function GameScreen() {
  const game = useGame((s) => s.game)
  const clear = useGame((s) => s.clearSelection)
  const root = useRef<HTMLDivElement>(null)
  useFlip(root, game)

  useEffect(() => {
    document.documentElement.classList.add('in-game')
    return () => {
      document.documentElement.classList.remove('in-game')
      resetFlip()
    }
  }, [])

  if (!game) return null
  return (
    <div
      ref={root}
      className="fixed inset-0 flex flex-col bg-sand pl-[var(--safe-l)] pr-[var(--safe-r)] land:grid land:grid-cols-[minmax(0,1fr)_minmax(10.5rem,12.5rem)] land:grid-rows-[1fr_auto] land:pl-[calc(var(--safe-l)*0.5)] land:pr-[calc(var(--safe-r)*0.5)]"
    >
      {/* vertical: barra arriba; horizontal: columna derecha */}
      <div className="land:col-start-2 land:row-span-2 land:flex land:min-h-0 land:flex-col land:border-l land:border-line/60 land:bg-sand-2/40">
        <TopBar />
        <div className="land:min-h-0 land:flex-1 land:overflow-y-auto land:px-2 land:pb-1">
          <PlayersBar />
        </div>
        <div className="hidden land:block land:px-2 land:pb-[calc(0.5rem+var(--safe-b)*0.5)]"><ActionBar vertical /></div>
      </div>
      <div className="felt min-h-0 flex-1 overflow-y-auto rounded-t-3xl land:col-start-1 land:row-start-1 land:rounded-none" onClick={clear}>
        <TableView />
      </div>
      <div className="land:hidden"><ActionBar /></div>
      <div className="land:col-start-1 land:row-start-2">
        <RackView />
      </div>
    </div>
  )
}
