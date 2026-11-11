import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DBProvider } from './ui/useDB';
import { ensureSeeded, openDB } from './db/db';
import { requestPersistentStorage } from './pwa';

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
