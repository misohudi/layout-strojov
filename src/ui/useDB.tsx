import { createContext, useContext, type ReactNode } from 'react';
import type { AppDB } from '../db/db';

const DBContext = createContext<AppDB | null>(null);

export function DBProvider({ db, children }: { db: AppDB; children: ReactNode }) {
  return <DBContext.Provider value={db}>{children}</DBContext.Provider>;
}

export function useDB(): AppDB {
  const db = useContext(DBContext);
  if (!db) throw new Error('DBProvider chýba');
  return db;
}
