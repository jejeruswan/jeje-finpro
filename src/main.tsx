import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.tsx'
import { installUiScale, toLocal } from './uiScale'

installUiScale()

// Motion measures layout with getBoundingClientRect (screen px) but animates
// in design px; this maps its measurements into the zoomed #root's space.
const toDesignPoint = ({ x, y }: { x: number; y: number }) => ({ x: toLocal(x), y: toLocal(y) })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig transformPagePoint={toDesignPoint}>
      <App />
    </MotionConfig>
  </StrictMode>,
)
