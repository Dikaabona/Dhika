import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

import { ConfirmationProvider } from './contexts/ConfirmationContext';

console.log("HR.Visibel: React mounting started...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("HR.Visibel: Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

try {
  console.log("HR.Visibel: Root element found, creating root...");
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <ConfirmationProvider>
      <App />
    </ConfirmationProvider>
  );
  console.log("HR.Visibel: React render called.");
} catch (err) {
  console.error("HR.Visibel: React mounting failed:", err);
  const errorMessage = err instanceof Error ? err.message : String(err);
  rootElement.innerHTML = `
    <div style="color: #e11d48; padding: 40px; font-family: sans-serif; text-align: center; background: #fff1f2; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 16px;">Error Mounting App</h1>
      <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #fecdd3; max-width: 600px; width: 100%; text-align: left; overflow: auto;">
        <pre style="margin: 0; white-space: pre-wrap; font-size: 14px; font-family: monospace;">${errorMessage}</pre>
      </div>
      <button onclick="window.location.reload()" style="margin-top: 24px; padding: 12px 24px; background: #e11d48; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Muat Ulang Halaman</button>
    </div>
  `;
}