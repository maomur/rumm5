# Rumm5

Juego de fichas (escaleras y grupos) para móvil: PWA, bots en 3 niveles y online con amigos.

- `npm run dev`: app en local
- `npm run dev:server` + `.env.development.local` con `VITE_PARTY_HOST=127.0.0.1:8787`: servidor online en local
- `npm test`: tests del motor, bots y salas
- `npm run build`: build de producción (Vercel la hace sola en cada push)
- Servidor online: Cloudflare Worker `rumm5` (rumm5.maomur.workers.dev) (Durable Objects), `npx wrangler deploy`
