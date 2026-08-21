import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App.tsx';
import './index.css';

// Auto-reload on Vite chunk preload errors or stale deployment bundle mismatch
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('MIME type') || e.message.includes('Loading chunk') || e.message.includes('Importing a module script failed'))) {
    const hasReloaded = sessionStorage.getItem('chunk_mismatch_reload');
    if (!hasReloaded) {
      sessionStorage.setItem('chunk_mismatch_reload', 'true');
      window.location.reload();
    }
  }
});

// Mute Three.js THREE.Clock deprecation warning
const origWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return;
  origWarn(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
