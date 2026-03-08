import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';

console.log("React mounting started...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

try {
  console.log("Root element found, creating root...");
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("React render called.");
} catch (err) {
  console.error("React mounting failed:", err);
  document.body.innerHTML = `<div style="color: red; padding: 20px;"><h1>Error Mounting App</h1><pre>${err instanceof Error ? err.message : String(err)}</pre></div>`;
}
