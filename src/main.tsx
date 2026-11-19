import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Corporate typeface: Swiss 721 Condensed / Arial Narrow – Roboto Condensed is the closest web font,
// bundled so the tablet shows it offline too (Latin + Latin Extended for Slovak letters only).
import '@fontsource/roboto-condensed/latin-300.css';
import '@fontsource/roboto-condensed/latin-ext-300.css';
import '@fontsource/roboto-condensed/latin-400.css';
import '@fontsource/roboto-condensed/latin-ext-400.css';
import '@fontsource/roboto-condensed/latin-700.css';
import '@fontsource/roboto-condensed/latin-ext-700.css';
import App from './App';
import { DBProvider } from './ui/useDB';
import { ensureSeeded, openDB } from './db/db';
import { requestPersistentStorage } from './pwa';
import { applyTheme, loadTheme } from './ui/theme';

// Two-finger zoom belongs to the floor plan only – stop Safari (iPad) from zooming the whole page.
document.addEventListener('gesturestart', (e) => e.preventDefault());

const db = openDB();
void requestPersistentStorage();

ensureSeeded(db).then(async () => {
  applyTheme(await loadTheme(db)); // before the first paint, so there is no light flash

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DBProvider db={db}>
        <App />
      </DBProvider>
    </StrictMode>,
  );
});
