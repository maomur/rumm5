// Vista previa jugable en un solo archivo HTML (artefacto del chat): sin PWA ni online
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: { 'import.meta.env.VITE_ARTIFACT': JSON.stringify('1') },
  build: { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000 },
})
