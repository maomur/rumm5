import { useEffect, useRef, type ReactNode } from 'react'
import { sfx } from '../audio/sfx'
import type { Check } from '../engine/types'
import { t } from '../i18n'
import { useGame } from '../store/gameStore'
import { flyIn } from './fx'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'good'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-sea text-white shadow-[0_3px_0_var(--color-sea-dark)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-sea-dark)]',
  good: 'bg-terra text-white shadow-[0_3px_0_var(--color-terra-dark)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-terra-dark)]',
  secondary: 'bg-ivory text-ink shadow-[0_2px_0_var(--color-line)] ring-1 ring-line active:translate-y-[1px]',
  danger: 'bg-terra text-white',
  ghost: 'bg-transparent text-ink',
}

/** Siempre visible. Si no se puede, sale gris y al tocar explica el motivo. */
export function ActionButton({
  children, onClick, check, variant = 'secondary', className = '', ignoreBusy = false, small = false, id,
}: {
  children: ReactNode
  onClick: () => void
  check?: Check
  variant?: Variant
  className?: string
  ignoreBusy?: boolean
  small?: boolean
  id?: string
}) {
  const busy = useGame((s) => s.busy)
  const showToast = useGame((s) => s.showToast)
  const blocked = (!ignoreBusy && busy) || (check && !check.ok)
  return (
    <button
      id={id}
      type="button"
      onClick={() => {
        if (check && !check.ok) { sfx.deny(); showToast(t(check.reason, check.vars), 'error'); return }
        if (!ignoreBusy && busy) return
        sfx.button()
        onClick()
      }}
      className={`font-display font-semibold rounded-2xl transition-all select-none ${small ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-base land:py-2'} ${VARIANT[variant]} ${blocked ? 'opacity-45 saturate-50' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

export function Popup({ children, origin, onClose, className = '' }: { children: ReactNode; origin?: string; onClose?: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (ref.current) flyIn(ref.current, origin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 animate-fade [perspective:900px]" onClick={() => close.current?.()}>
      <div
        ref={ref}
        className={`w-full max-w-sm land:max-w-lg rounded-3xl bg-ivory p-5 land:p-4 shadow-2xl ring-1 ring-line max-h-[90dvh] overflow-y-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function Sheet({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 animate-fade land:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl land:rounded-3xl bg-ivory p-5 pb-[calc(1.25rem+var(--safe-b))] shadow-2xl max-h-[88dvh] overflow-y-auto"
        style={{ animation: 'pop-in .28s cubic-bezier(.2,.9,.3,1.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button type="button" className="rounded-full px-3 py-1 text-2xl leading-none text-ink/60" onClick={onClose} aria-label={t('menu.close')}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const AVATAR_COLORS = ['#0B5CAD', '#B0442D', '#C9861A', '#3E7D5A']
export const AVATAR_GLYPHS = ['◆', '●', '▲', '■']

export function Avatar({ index, size = 34, dim = false }: { index: number; size?: number; dim?: boolean }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full font-display text-white"
      style={{ width: size, height: size, background: dim ? '#9a9286' : AVATAR_COLORS[index % 4], fontSize: size * 0.45 }}
    >
      {AVATAR_GLYPHS[index % 4]}
    </div>
  )
}
