import { useEffect } from 'react'

/** Desvanece la bienvenida estática de index.html cuando React ya está listo */
export function Splash() {
  useEffect(() => {
    const el = document.getElementById('static-splash')
    if (!el) return
    const started = Number(el.dataset.t ?? performance.now())
    const wait = Math.max(0, 1400 - (performance.now() - started))
    const id = setTimeout(() => {
      el.style.opacity = '0'
      setTimeout(() => el.remove(), 550)
    }, wait)
    return () => clearTimeout(id)
  }, [])
  return null
}
