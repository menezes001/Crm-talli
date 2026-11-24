import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Ignore uncaught errors injected solely by third-party browser extensions (e.g. VPN/proxy interceptors)
window.addEventListener(
  'error',
  (event) => {
    const source = event.filename || event.error?.stack || '';
    if (
      source.includes('chrome-extension://') ||
      source.includes('moz-extension://')
    ) {
      event.preventDefault();
    }
  },
  true
);

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
