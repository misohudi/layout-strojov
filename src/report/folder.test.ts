import { openDB, ensureSeeded, type AppDB } from '../db/db';
import { exportBackup, importBackup } from '../backup/backup';
import {
  isFolderSupported, pickReportFolder, getReportFolder, saveToReportFolder,
  getFolderLabel, setFolderLabel,
} from './folder';

/** Minimal stand-in for the browser's FileSystemDirectoryHandle. */
function fakeDir(name: string, permission: PermissionState = 'granted') {
  const files = new Map<string, Blob>();
  const dir = {
    kind: 'directory',
    name,
    files,
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => permission),
    getFileHandle: vi.fn(async (fileName: string) => ({
      createWritable: async () => {
        let data: Blob | null = null;
        return {
          write: async (b: Blob) => { data = b; },
          close: async () => { files.set(fileName, data!); },
        };
      },
    })),
  };
  return dir;
}

const win = window as unknown as { showDirectoryPicker?: unknown };
let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = openDB(`folder-${++n}-${Math.random()}`);
  await ensureSeeded(db);
});
afterEach(() => {
  delete win.showDirectoryPicker;
  db.close();
});

test('support is detected from the browser', () => {
  expect(isFolderSupported()).toBe(false);
  win.showDirectoryPicker = vi.fn();
  expect(isFolderSupported()).toBe(true);
});

test('picking a folder remembers it on the tablet', async () => {
  const dir = fakeDir('REPORT_OBSADENOST');
  win.showDirectoryPicker = vi.fn(async () => dir);
  expect(await pickReportFolder(db)).toBe('REPORT_OBSADENOST');
  expect(win.showDirectoryPicker).toHaveBeenCalledWith(expect.objectContaining({ mode: 'readwrite' }));
  expect((await getReportFolder(db))?.name).toBe('REPORT_OBSADENOST');
});

test('cancelling the picker keeps the previous folder', async () => {
  win.showDirectoryPicker = vi.fn(async () => fakeDir('A'));
  await pickReportFolder(db);
  win.showDirectoryPicker = vi.fn(async () => { throw new DOMException('x', 'AbortError'); });
  expect(await pickReportFolder(db)).toBeNull();
  expect((await getReportFolder(db))?.name).toBe('A');
});

test('saving writes the report file into the chosen folder', async () => {
  const dir = fakeDir('REPORT_OBSADENOST');
  win.showDirectoryPicker = vi.fn(async () => dir);
  await pickReportFolder(db);
  const blob = new Blob(['xlsx']);
  expect(await saveToReportFolder(db, blob, 'Obsadenost_Frezy_2026-11-11_zmena-B.xlsx')).toEqual({ ok: true, folder: 'REPORT_OBSADENOST' });
  expect(dir.files.get('Obsadenost_Frezy_2026-11-11_zmena-B.xlsx')).toBe(blob);
  expect(dir.getFileHandle).toHaveBeenCalledWith('Obsadenost_Frezy_2026-11-11_zmena-B.xlsx', { create: true });
});

test('without a chosen folder nothing is saved', async () => {
  expect(await saveToReportFolder(db, new Blob(['x']), 'a.xlsx')).toEqual({ ok: false, reason: 'no-folder' });
});

test('if access to the folder is refused the report is not lost silently', async () => {
  const dir = fakeDir('Q', 'denied');
  win.showDirectoryPicker = vi.fn(async () => dir);
  await pickReportFolder(db);
  expect(await saveToReportFolder(db, new Blob(['x']), 'a.xlsx')).toEqual({ ok: false, reason: 'denied' });
  expect(dir.files.size).toBe(0);
});

test('a write error (e.g. network share unavailable) is reported', async () => {
  const dir = fakeDir('Q');
  dir.getFileHandle = vi.fn(async () => { throw new DOMException('offline', 'NotFoundError'); });
  win.showDirectoryPicker = vi.fn(async () => dir);
  await pickReportFolder(db);
  expect(await saveToReportFolder(db, new Blob(['x']), 'a.xlsx')).toEqual({ ok: false, reason: 'error', message: 'offline' });
});

test('the folder description (path) can be set', async () => {
  expect(await getFolderLabel(db)).toBe('');
  await setFolderLabel(db, '  Q:\\REPORTY  ');
  expect(await getFolderLabel(db)).toBe('Q:\\REPORTY');
});

test('a backup restored on another device does not bring a broken folder link', async () => {
  win.showDirectoryPicker = vi.fn(async () => fakeDir('A'));
  await pickReportFolder(db);
  const other = openDB(`folder-other-${Math.random()}`);
  await importBackup(other, await exportBackup(db));
  expect(await getReportFolder(other)).toBeUndefined();
  other.close();
});
