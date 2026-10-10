import { memo } from 'react'
import { colorOf, isJoker, valueOf } from '../engine/tiles'
import type { TileId } from '../engine/types'

export function JokerFace({ size = '60%' }: { size?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <circle cx="20" cy="20" r="17" fill="none" stroke="#B0442D" strokeWidth="3.2" />
      <circle cx="14" cy="16" r="3" fill="#0B5CAD" />
      <circle cx="26" cy="16" r="3" fill="#C9861A" />
      <path d="M11 24 Q20 33 29 24" fill="none" stroke="#23262B" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}

interface Props {
  tile: TileId
  small?: boolean
  selected?: boolean
  fresh?: boolean
  hint?: boolean
  onTap?: (t: TileId) => void
}

export const Tile = memo(function Tile({ tile, small, selected, fresh, hint, onTap }: Props) {
  const joker = isJoker(tile)
  const cls = ['tile', small && 'sm', !joker && `c${colorOf(tile)}`, selected && 'selected', fresh && 'fresh', hint && 'hint'].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      data-tile={tile}
      className={cls}
      onClick={onTap ? (e) => { e.stopPropagation(); onTap(tile) } : undefined}
      aria-label={joker ? 'Comodín' : `${valueOf(tile)}`}
      aria-pressed={selected}
    >
      {joker ? <JokerFace /> : (
        <>
          <span className="num">{valueOf(tile)}</span>
          <span className="dot" />
        </>
      )}
    </button>
  )
})

/** Fichas de adorno (logo, iconos): letra o número con color */
export function FaceTile({ label, color, w = 44 }: { label: string; color: 0 | 1 | 2 | 3; w?: number }) {
  return (
    <div className={`tile c${color}`} style={{ ['--w' as string]: `${w}px` }}>
      <span className="num">{label}</span>
      <span className="dot" />
    </div>
  )
}

export function Logo({ w = 44 }: { w?: number }) {
  const letters: [string, 0 | 1 | 2 | 3][] = [['R', 1], ['U', 2], ['M', 0], ['M', 3], ['5', 1]]
  return (
    <div className="flex items-end gap-1.5" aria-label="Rumm5">
      {letters.map(([l, c], i) => (
        <div key={i} style={{ transform: `rotate(${[-6, 3, -2, 4, -5][i]}deg) translateY(${[2, -3, 0, -2, 3][i]}px)` }}>
          <FaceTile label={l} color={c} w={w} />
        </div>
      ))}
    </div>
  )
}
