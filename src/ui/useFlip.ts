import { useEffect, useLayoutEffect, type RefObject } from 'react'
import type { GameState } from '../engine/types'

// FLIP: cada ficha ([data-tile]) recuerda dónde estaba y se desliza a su nuevo sitio.
// Las que aparecen nuevas vuelan desde su origen (el jugador que las coloca o la bolsa).

let rects = new Map<string, DOMRect>()

function measure(root: HTMLElement) {
  const next = new Map<string, DOMRect>()
  root.querySelectorAll<HTMLElement>('[data-tile]').forEach((el) => next.set(el.dataset.tile!, el.getBoundingClientRect()))
  return next
}

export function useFlip(rootRef: RefObject<HTMLElement | null>, game: GameState | null) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !game) return
    const firstRun = rects.size === 0
    // origen de las fichas nuevas según los eventos de esta acción
    const origin = new Map<number, string>()
    for (const ev of game.events) {
      if (ev.type === 'play') ev.tiles.forEach((t) => origin.set(t, `player-${ev.playerId}`))
      if (ev.type === 'draw') ev.tiles.forEach((t) => origin.set(t, 'pool'))
    }
    const fallbackOrigin = `player-${game.players[game.current]?.id}`
    const next = new Map<string, DOMRect>()
    root.querySelectorAll<HTMLElement>('[data-tile]').forEach((el) => {
      const id = el.dataset.tile!
      const r = el.getBoundingClientRect()
      next.set(id, r)
      if (firstRun) return
      const prev = rects.get(id)
      if (prev) {
        const dx = prev.left - r.left
        const dy = prev.top - r.top
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
          el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' })
      } else {
        const src = document.getElementById(origin.get(Number(id)) ?? fallbackOrigin)
        if (!src) return
        const o = src.getBoundingClientRect()
        const dx = o.left + o.width / 2 - (r.left + r.width / 2)
        const dy = o.top + o.height / 2 - (r.top + r.height / 2)
        el.animate(
          [
            { transform: `translate(${dx}px,${dy}px) scale(.4) rotate(-12deg)`, opacity: 0 },
            { transform: `translate(${dx * 0.3}px,${dy * 0.3 - 24}px) scale(1.12) rotate(3deg)`, opacity: 1, offset: 0.6 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 720, delay: Math.random() * 160, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'backwards' },
        )
      }
    })
    rects = next
  }, [game, rootRef])

  // al hacer scroll o girar el móvil, las posiciones guardadas dejan de valer
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let raf = 0
    const refresh = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { if (rootRef.current) rects = measure(rootRef.current) })
    }
    root.addEventListener('scroll', refresh, { capture: true, passive: true })
    window.addEventListener('resize', refresh)
    return () => {
      root.removeEventListener('scroll', refresh, { capture: true })
      window.removeEventListener('resize', refresh)
      cancelAnimationFrame(raf)
    }
  }, [rootRef])
}

export function resetFlip() {
  rects = new Map()
}
