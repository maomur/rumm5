// Identidad sin cuentas: una clave aleatoria por dispositivo
const KEY = 'rumm5.deviceKey'

export function deviceKey(): string {
  try {
    let k = localStorage.getItem(KEY)
    if (!k) {
      k = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(KEY, k)
    }
    return k
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2)
  }
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newRoomCode(): string {
  return Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')
}
