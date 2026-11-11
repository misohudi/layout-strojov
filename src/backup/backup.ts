import { TABLES, setMeta, type AppDB } from '../db/db';

const APP = 'layout-strojov';
const VERSION = 1;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

export function backupFileName(now: Date): string {
  return `zaloha-layout-strojov-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export async function exportBackup(db: AppDB): Promise<Blob> {
  const tables: Record<string, unknown[]> = {};
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) tables[t] = await db.table(t).toArray();
  });
  const payload = { app: APP, version: VERSION, exportedAt: new Date().toISOString(), tables };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function importBackup(db: AppDB, file: Blob): Promise<void> {
  let data: { app?: unknown; version?: unknown; tables?: Record<string, unknown[]> };
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Neplatný súbor zálohy');
  }
  if (data?.app !== APP || data.version !== VERSION || typeof data.tables !== 'object' || !data.tables) {
    throw new Error('Neplatný súbor zálohy');
  }
  const tables = data.tables;
  if (!TABLES.every((t) => Array.isArray(tables[t]))) throw new Error('Neplatný súbor zálohy');
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkPut(tables[t]);
    }
    await setMeta(db, 'lastBackupAt', new Date().toISOString());
  });
}

export function isBackupDue(lastBackupAt: string | undefined, now: Date): boolean {
  if (!lastBackupAt) return true;
  return now.getTime() - new Date(lastBackupAt).getTime() > WEEK_MS;
}
