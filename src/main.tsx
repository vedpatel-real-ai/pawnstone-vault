import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initOfflineQueue, processQueue } from './lib/offlineQueue'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)

// PWA service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error)
  })
}

// Initialize offline queue
initOfflineQueue()
// Attempt processing at startup
processQueue().catch(() => {})

