import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DBProvider } from './ui/useDB';
import { ensureSeeded, openDB } from './db/db';

const db = openDB();

ensureSeeded(db).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DBProvider db={db}>
        <App />
      </DBProvider>
    </StrictMode>,
  );
});
