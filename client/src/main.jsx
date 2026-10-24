import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applySavedPrefs, PrefsProvider } from './prefs.jsx';
import './styles.css';

applySavedPrefs();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrefsProvider>
      <App />
    </PrefsProvider>
  </StrictMode>,
);
