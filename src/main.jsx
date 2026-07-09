import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { MotionConfig } from 'framer-motion'
import { ToastProvider } from './app/components/Toast'
import './index.css'
import App from './app/App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <App />
        </ToastProvider>
      </MotionConfig>
    </HelmetProvider>
  </StrictMode>
)
