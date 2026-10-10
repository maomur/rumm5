import { es } from './es'

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = es[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}
