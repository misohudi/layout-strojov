import { openDB, ensureSeeded, getMeta, TABLES, type AppDB } from '../db/db';
import { startDraft, upsertPerson, setMachineType } from '../db/repo';
import { exportBackup, importBackup, isBackupDue, backupFileName } from './backup';

let n = 0;
const fresh = () => openDB(`bk-${++n}-${Math.random()}`);
let a: AppDB, b: AppDB;
beforeEach(async () => {
  a = fresh();
  b = fresh();
  await ensureSeeded(a);
});
afterEach(() => {
  a.close();
  b.close();
});

const dump = async (db: AppDB, skipMeta = false) => {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    let rows = await db.table(t).toArray();
    if (skipMeta && t === 'meta') rows = rows.filter((r) => r.key !== 'lastBackupAt');
    out[t] = rows;
  }
  return out;
};

test('export then import restores every table', async () => {
  await upsertPerson(a, { name: 'Kováč', shiftId: 's-A', active: true });
  await startDraft(a, 's-A', 'Novák', new Date());
  await setMachineType(a, 's-A', 'm-0', 'EXT');
  await importBackup(b, await exportBackup(a));
  expect(await dump(b, true)).toEqual(await dump(a, true));
  expect(await getMeta(b, 'lastBackupAt')).toBeDefined();
});

test('invalid backup is rejected and leaves the DB untouched', async () => {
  await ensureSeeded(b);
  const before = await dump(b);
  const bad = new Blob([JSON.stringify({ app: 'iné', version: 1, tables: {} })]);
  await expect(importBackup(b, bad)).rejects.toThrow('Neplatný súbor zálohy');
  await expect(importBackup(b, new Blob(['nie je json']))).rejects.toThrow('Neplatný súbor zálohy');
  expect(await dump(b)).toEqual(before);
});

test('isBackupDue after 7 days', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  expect(isBackupDue(undefined, now)).toBe(true);
  expect(isBackupDue('2026-11-05T12:00:00Z', now)).toBe(false);
  expect(isBackupDue('2026-11-03T12:00:00Z', now)).toBe(true);
});

test('backupFileName', () => {
  expect(backupFileName(new Date(2026, 10, 11, 9))).toBe('zaloha-layout-strojov-2026-11-11.json');
});
