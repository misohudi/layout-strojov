import { openDB, ensureSeeded, getMeta, type AppDB } from '../db/db';
import { applyTheme, loadTheme, saveTheme } from './theme';

let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = openDB(`theme-${++n}-${Math.random()}`);
  await ensureSeeded(db);
  delete document.documentElement.dataset.theme;
});
afterEach(() => db.close());

test('default appearance is light', async () => {
  expect(await loadTheme(db)).toBe('light');
});

test('applyTheme marks the document so CSS switches colours', () => {
  applyTheme('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  applyTheme('system');
  expect(document.documentElement.dataset.theme).toBe('system');
});

test('saveTheme stores the choice on the tablet and applies it immediately', async () => {
  await saveTheme(db, 'dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(await getMeta(db, 'theme')).toBe('dark');
  expect(await loadTheme(db)).toBe('dark');
});

test('an unknown stored value falls back to light', async () => {
  await db.meta.put({ key: 'theme', value: 'purple' });
  expect(await loadTheme(db)).toBe('light');
});
