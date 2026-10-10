import { useMemo } from 'react'
import { currentPlayer, meldKey, playerById } from '../engine/queries'
import { analyzeMeld, colorOf, isJoker, valueOf } from '../engine/tiles'
import type { GameState, TileId } from '../engine/types'
import { t } from '../i18n'
import { useGame } from '../store/gameStore'
import { Tile } from './Tile'

function sortRack(rack: TileId[], mode: 'color' | 'number') {
  return [...rack].sort((a, b) => {
    if (isJoker(a) !== isJoker(b)) return isJoker(a) ? 1 : -1
    if (isJoker(a)) return a - b
    return mode === 'color'
      ? colorOf(a) - colorOf(b) || valueOf(a) - valueOf(b) || a - b
      : valueOf(a) - valueOf(b) || colorOf(a) - colorOf(b) || a - b
  })
}

/** Puntos de la primera bajada que lleva el jugador en el borrador */
export function firstMeldProgress(g: GameState): number {
  const committed = new Set(g.table.map((m) => meldKey(m.tiles)))
  return g.draft.table.reduce((sum, m) => {
    if (committed.has(meldKey(m.tiles))) return sum
    const a = analyzeMeld(m.tiles)
    return sum + (a.valid ? a.points : 0)
  }, 0)
}

export function RackView() {
  const game = useGame((s) => s.game)!
  const viewerId = useGame((s) => s.viewerId)
  const selected = useGame((s) => s.selected)
  const sortMode = useGame((s) => s.sortMode)
  const setSort = useGame((s) => s.setSort)
  const fresh = useGame((s) => s.fresh)
  const hint = useGame((s) => s.hint)
  const toggleSelect = useGame((s) => s.toggleSelect)
  const moveTo = useGame((s) => s.moveSelectedTo)

  const viewer = viewerId ? playerById(game, viewerId) : undefined
  const cur = currentPlayer(game)
  const myTurn = game.phase === 'play' && cur.id === viewerId
  const rack = viewer ? (myTurn ? game.draft.rack : viewer.rack) : []
  const sorted = useMemo(() => sortRack(rack, sortMode), [rack, sortMode])
  const selectedSet = new Set(selected)
  const freshSet = new Set(fresh)
  const hintSet = new Set(hint)
  const ownOnTable = myTurn && selected.some((x) => viewer!.rack.includes(x) && !game.draft.rack.includes(x))

  if (!viewer) return null
  const progress = myTurn && !viewer.hasMelded ? firstMeldProgress(game) : null

  return (
    <div className="bg-sand-2/70 px-2 pt-1.5 pb-[calc(0.5rem+var(--safe-b))] land:pb-[calc(0.35rem+var(--safe-b)*0.5)] land:pt-1">
      <div className="mb-1.5 flex items-center gap-2 px-1 text-xs land:mb-1">
        <div className="flex overflow-hidden rounded-full ring-1 ring-line">
          {(['color', 'number'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setSort(m)} className={`px-2.5 py-1 font-display font-semibold ${sortMode === m ? 'bg-ink text-sand' : 'bg-ivory text-ink/70'}`}>
              {m === 'color' ? t('game.sortColor') : t('game.sortNumber')}
            </button>
          ))}
        </div>
        {progress !== null && (
          <div className={`min-w-0 truncate rounded-full px-2 py-1 font-semibold ${progress >= game.settings.initialMeld ? 'bg-good/15 text-good' : 'bg-ochre/15 text-ochre'}`}>
            {t('game.firstMeldHint', { need: game.settings.initialMeld, points: progress })}
          </div>
        )}
        <div className="ml-auto flex-none text-ink/50">{t('game.tiles', { n: rack.length })}</div>
      </div>
      <div
        id="rack"
        className="flex max-h-[calc(var(--rack-w)*1.34*2+1.4rem)] flex-wrap content-start justify-center gap-[calc(var(--rack-w)*0.1)] overflow-y-auto pt-[calc(var(--rack-w)*0.24)] land:max-h-[calc(var(--rack-w)*1.34*2+1rem)]"
        onClick={ownOnTable ? () => moveTo({ kind: 'rack' }) : undefined}
      >
        {sorted.map((tile) => (
          <Tile
            key={tile}
            tile={tile}
            selected={selectedSet.has(tile)}
            fresh={freshSet.has(tile)}
            hint={hintSet.has(tile)}
            onTap={myTurn ? toggleSelect : undefined}
          />
        ))}
        {ownOnTable && (
          <button type="button" className="tile ghost" onClick={(e) => { e.stopPropagation(); moveTo({ kind: 'rack' }) }}>
            <span className="text-[calc(var(--w)*0.24)] font-semibold leading-tight">↩<br />{t('game.toRack')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
