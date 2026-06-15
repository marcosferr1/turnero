import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './auth'
import { ConfirmProvider } from './components/ConfirmProvider'
import { GetLoaderBar } from './components/GetLoaderBar'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <GetLoaderBar />
      <AuthProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
