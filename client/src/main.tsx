import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resources from './i18n';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import './index.css';

i18n.use(initReactI18next).init({
  resources,
  // Website UI is English-only. Patient conversation language is resolved
  // independently by the session/patient services and is not controlled here.
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en'],
  interpolation: { escapeValue: false },
});

// Ignore and clear the old UI preference so a prior Arabic choice cannot
// restore RTL/UI translations after a refresh.
localStorage.removeItem('synoza_lang');
document.documentElement.lang = 'en';
document.documentElement.dir = 'ltr';
document.documentElement.classList.remove('font-arabic');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
