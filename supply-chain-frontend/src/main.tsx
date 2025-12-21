import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'

// Setup Trusted Types policy to handle third-party libraries (like Leaflet) modifying the DOM
// This fixes the "This document requires 'TrustedHTML' assignment" error
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: (string: string) => string,
      createScript: (string: string) => string,
      createScriptURL: (string: string) => string,
    });
  } catch (e) {
    // Policy might already exist
    console.warn('Trusted Types policy "default" could not be created', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
