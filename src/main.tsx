/**
 * Application Entry Point
 * 
 * Renders the React application into the DOM.
 * Imports global styles that apply to the entire application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initBrowserMock } from './mock/browserMock';
import './styles/global.css';

// Initialize in-browser simulation if opened via localhost outside Electron
initBrowserMock();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element not found. Make sure index.html contains a <div id="root"></div>.'
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
