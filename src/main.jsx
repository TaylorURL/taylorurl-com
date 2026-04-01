import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { ToastProvider } from './app/components/Toast'
import { AuthProvider } from './app/contexts/AuthContext'
import './index.css'
import App from './app/App'
import ErrorReporterUtility, { ErrorBoundary } from './app/lib/ErrorReporterUtility'

ErrorReporterUtility.init({ project: 'taylorurl.com' })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </HelmetProvider>
  </StrictMode>
)
