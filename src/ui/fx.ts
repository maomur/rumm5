// Efectos sueltos: fichas fantasma que vuelan, confeti, vuelo de popups

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

/** Fichas boca abajo volando de un elemento a otro (por id del DOM) */
export function fly(fromId: string, toId: string, count = 1) {
  const a = document.getElementById(fromId)
  const b = document.getElementById(toId)
  if (!a || !b) return
  const ra = a.getBoundingClientRect()
  const rb = b.getBoundingClientRect()
  const p = center(ra)
  const q = center(rb)
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.className = 'tile-back fx-ghost'
    el.style.left = `${p.x - 14}px`
    el.style.top = `${p.y - 19}px`
    document.body.appendChild(el)
    const anim = el.animate(
      [
        { transform: 'translate(0,0) scale(.7) rotate(-10deg)', opacity: 0 },
        { transform: `translate(${(q.x - p.x) * 0.5}px, ${(q.y - p.y) * 0.5 - 40}px) scale(1.1) rotate(4deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${q.x - p.x}px, ${q.y - p.y}px) scale(.5) rotate(0)`, opacity: 0.2 },
      ],
      { duration: 650, delay: i * 140, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' },
    )
    anim.onfinish = () => el.remove()
  }
}

/** El popup sale volando desde un elemento de origen (método BCN Tycoon) */
export function flyIn(el: HTMLElement, originId?: string) {
  const origin = originId ? document.getElementById(originId) : null
  if (!origin) {
    el.animate(
      [
        { transform: 'translateY(24px) scale(.92)', opacity: 0 },
        { transform: 'translateY(-6px) scale(1.02)', opacity: 1, offset: 0.6 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 480, easing: 'cubic-bezier(.2,.85,.25,1)' },
    )
    return
  }
  const a = origin.getBoundingClientRect(), b = el.getBoundingClientRect()
  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2)
  const sc = Math.max(0.08, Math.min(a.width / b.width, 0.3))
  el.animate([
    { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotateX(65deg) rotateZ(-14deg)`, opacity: .35, filter: 'brightness(1.8)' },
    { transform: 'translate(0,-16px) scale(1.06) rotateX(-10deg) rotateZ(2deg)', opacity: 1, filter: 'brightness(1.15)', offset: .58 },
    { transform: 'translate(0,5px) scale(.985) rotateX(4deg) rotateZ(-.5deg)', filter: 'brightness(1)', offset: .8 },
    { transform: 'none', opacity: 1 },
  ], { duration: 720, easing: 'cubic-bezier(.2,.85,.25,1)' })
}

const CONFETTI = ['#0B5CAD', '#B0442D', '#C9861A', '#2B2B2B', '#F4ECDD']

export function confetti(n = 70) {
  const w = window.innerWidth
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div')
    el.className = 'fx-confetti'
    el.style.background = CONFETTI[i % CONFETTI.length]
    el.style.left = `${Math.random() * w}px`
    document.body.appendChild(el)
    const fall = window.innerHeight + 40
    const drift = (Math.random() - 0.5) * 160
    const anim = el.animate(
      [
        { transform: `translate(0,-20px) rotate(0)`, opacity: 1 },
        { transform: `translate(${drift}px, ${fall}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0.9 },
      ],
      { duration: 1800 + Math.random() * 1400, delay: Math.random() * 500, easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'both' },
    )
    anim.onfinish = () => el.remove()
  }
}
