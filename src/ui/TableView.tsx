import { useMemo } from 'react'
import { sfx } from '../audio/sfx'
import { currentPlayer, meldKey } from '../engine/queries'
import { analyzeMeld } from '../engine/tiles'
import type { TileId } from '../engine/types'
import { t } from '../i18n'
import { useGame } from '../store/gameStore'
import { Tile } from './Tile'

export function TableView() {
  const game = useGame((s) => s.game)!
  const selected = useGame((s) => s.selected)
  const viewerId = useGame((s) => s.viewerId)
  const glow = useGame((s) => s.glowMelds)
  const recent = useGame((s) => s.recentMelds)
  const invalid = useGame((s) => s.invalidMelds)
  const toggleSelect = useGame((s) => s.toggleSelect)
  const moveTo = useGame((s) => s.moveSelectedTo)
  const showToast = useGame((s) => s.showToast)

  const cur = currentPlayer(game)
  const myTurn = game.phase === 'play' && cur.id === viewerId
  const committed = useMemo(() => new Set(game.table.map((m) => meldKey(m.tiles))), [game.table])
  const committedTiles = useMemo(() => new Set(game.table.flatMap((m) => m.tiles)), [game.table])
  const selectedSet = new Set(selected)
  const placing = myTurn && selected.length > 0

  const onTile = (tile: TileId) => {
    if (!myTurn) return
    if (!cur.hasMelded && committedTiles.has(tile)) {
      sfx.deny()
      showToast(t('err.firstMeldNoTouch', { need: game.settings.initialMeld }), 'error')
      return
    }
    toggleSelect(tile)
  }

  const melds = game.draft.table
  return (
    <div className="flex min-h-full flex-wrap content-start items-start gap-x-[calc(var(--table-w)*0.45)] gap-y-[calc(var(--table-w)*0.4)] p-3 pb-6">
      {melds.length === 0 && (
        <p className="m-auto max-w-[17rem] pt-8 text-center text-sm text-ink/45">{t('game.emptyTable')}</p>
      )}
      {melds.map((m) => {
        const a = analyzeMeld(m.tiles)
        const changed = !committed.has(meldKey(m.tiles))
        const cls = [
          'meld',
          changed && (a.valid ? 'pending' : 'invalid'),
          recent.includes(m.id) ? 'recent' : glow.includes(m.id) && 'glow',
          invalid.includes(m.id) && 'shake',
        ].filter(Boolean).join(' ')
        return (
          <div key={m.id} className={cls} onClick={placing ? () => moveTo({ kind: 'meld', meldId: m.id }) : undefined}>
            {a.ordered.map((p) => (
              <Tile key={p.tile} tile={p.tile} small selected={selectedSet.has(p.tile)} onTap={myTurn ? onTile : undefined} />
            ))}
            {/* el hueco del "+" está siempre reservado: al seleccionar fichas la mesa no se recoloca */}
            <button
              type="button"
              className={`tile sm ghost ${placing ? '' : 'invisible'}`}
              aria-label="Añadir aquí"
              tabIndex={placing ? 0 : -1}
              aria-hidden={!placing}
              onClick={(e) => { e.stopPropagation(); if (placing) moveTo({ kind: 'meld', meldId: m.id }) }}
            >
              <span className="num">+</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
