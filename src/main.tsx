import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGame } from './store/gameStore'

// la bienvenida estática vive fuera de #root para que React no la borre al montar
const splash = document.getElementById('static-splash')
if (splash) document.body.appendChild(splash)

;(window as unknown as { __game: unknown }).__game = useGame

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
