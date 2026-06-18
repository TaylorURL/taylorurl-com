import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { MotionConfig } from 'framer-motion'
import { ToastProvider } from './app/components/Toast'
import { SundayAnalyticsProvider } from './lib/sunday-analyzer'
import './index.css'
import App from './app/App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SundayAnalyticsProvider siteKey="sa_3f6a07135e29f39beffe158c4c89e40b">
      <HelmetProvider>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <App />
          </ToastProvider>
        </MotionConfig>
      </HelmetProvider>
    </SundayAnalyticsProvider>
  </StrictMode>
)
