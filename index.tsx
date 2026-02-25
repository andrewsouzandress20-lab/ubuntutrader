import React from 'react';
import ReactDOM from 'react-dom/client';
<<<<<<< HEAD
import App from './App';
import './src/index.css';
=======
import App from './App.js';
import ErrorBoundary from './components/ErrorBoundary.js';
// ... Tailwind CSS é importado via App.tsx ...
>>>>>>> 66ed77ac784d73b870a1a9bdaab2199bd65d79cc

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
