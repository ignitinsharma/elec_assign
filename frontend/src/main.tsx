import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HealthPage } from './pages/HealthPage'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HealthPage />
  </StrictMode>,
)
