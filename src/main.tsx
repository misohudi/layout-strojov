import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DBProvider } from './ui/useDB';
import { ensureSeeded, openDB } from './db/db';
import { requestPersistentStorage } from './pwa';

// Two-finger zoom belongs to the floor plan only – stop Safari (iPad) from zooming the whole page.
document.addEventListener('gesturestart', (e) => e.preventDefault());

const db = openDB();
void requestPersistentStorage();

ensureSeeded(db).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DBProvider db={db}>
        <App />
      </DBProvider>
    </StrictMode>,
  );
});
