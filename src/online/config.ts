// Servidor online (Cloudflare Worker). En local: VITE_PARTY_HOST=127.0.0.1:8787 en .env.development.local
export const PARTY_HOST: string = import.meta.env.VITE_PARTY_HOST ?? 'rumm5.maomur.workers.dev'
