// mulberry32: la semilla vive en el estado, así las partidas son reproducibles
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0
  const next = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

/** Baraja en el sitio y devuelve la nueva semilla */
export function shuffle<T>(arr: T[], seed: number): number {
  let s = seed
  for (let i = arr.length - 1; i > 0; i--) {
    const [r, n] = nextRandom(s)
    s = n
    const j = Math.floor(r * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return s
}
