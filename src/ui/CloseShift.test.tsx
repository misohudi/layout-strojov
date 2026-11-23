import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { DBProvider } from './useDB';
import { openDB, ensureSeeded, type AppDB } from '../db/db';
import { startDraft, setMachineType, togglePerson, upsertPerson } from '../db/repo';
import { shareOrDownload, shareOrDownloadFiles } from '../report/share';
import { pickReportFolder } from '../report/folder';

vi.mock('../report/share', () => ({ shareOrDownload: vi.fn(async () => 'shared'), shareOrDownloadFiles: vi.fn(async () => 'shared'), downloadBlob: vi.fn() }));

let db: AppDB;
let n = 0;
beforeEach(async () => {
  vi.mocked(shareOrDownload).mockReset().mockResolvedValue('shared');
  vi.mocked(shareOrDownloadFiles).mockReset().mockResolvedValue('shared');
  db = openDB(`close-${++n}-${Math.random()}`);
  await ensureSeeded(db);
  const p = await upsertPerson(db, { name: 'Kováč', shiftId: 's-B', active: true });
  await startDraft(db, 's-B', 'Novák', new Date(2026, 10, 11, 14, 0));
  await setMachineType(db, 's-B', 'm-0', 'EXT');
  await togglePerson(db, 's-B', 'm-1', p); // people without type
});
// Unmount first: live queries of still-mounted components must not hit a closed database.
afterEach(() => {
  cleanup();
  db.close();
});

async function openLayout() {
  render(<DBProvider db={db}><App /></DBProvider>);
  await userEvent.click(await screen.findByRole('button', { name: /^B/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Uzavrieť zmenu a vytvoriť report' }));
}

// Generating the report lazy-loads ExcelJS, which can be slow on a cold, busy test run.
const SLOW = { timeout: 8000 };

/** After closing: Exportovať → the Excel ticked; returns the export sheet. */
async function exportExcel() {
  await userEvent.click(await screen.findByRole('button', { name: 'Exportovať' }, SLOW));
  const sheet = await screen.findByRole('dialog', { name: 'Exportovať' });
  await userEvent.click(within(sheet).getByRole('checkbox', { name: /^Excel/ }));
  return sheet;
}

test('close dialog warns about machines with people but no type', async () => {
  await openLayout();
  const dialog = await screen.findByRole('dialog', { name: 'Uzavrieť zmenu' });
  expect(dialog).toHaveTextContent('1 stroj má ľudí bez farby');
});

test('closing saves the record and exports nothing by itself; Exportovať offers the files, then back to the picker', async () => {
  await openLayout();
  await userEvent.click(await screen.findByRole('button', { name: 'Uzavrieť zmenu' }));
  expect(await screen.findByText(/Zmena je uzavretá a uložená v histórii\./, {}, SLOW)).toBeInTheDocument();
  const records = await db.records.toArray();
  expect(records).toHaveLength(1);
  expect(records[0].stats.ext).toBe(1);
  expect(await db.drafts.get('s-B')).toBeUndefined();
  expect(shareOrDownloadFiles).not.toHaveBeenCalled();

  const sheet = await exportExcel();
  await userEvent.click(within(sheet).getByRole('button', { name: 'Zdieľať' }));
  await vi.waitFor(() => expect(vi.mocked(shareOrDownloadFiles).mock.calls[0][0].map((f) => f.name)).toEqual(['Obsadenost_2026-11-11_zmena-B.xlsx']), SLOW);
  await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Exportovať' })).toBeNull());
  await userEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  expect(await screen.findByText('Vyber svoju zmenu')).toBeInTheDocument();
});

test('a failing share shows the error and keeps the export usable', async () => {
  vi.mocked(shareOrDownloadFiles).mockRejectedValueOnce(new Error('Zdieľanie zlyhalo'));
  await openLayout();
  await userEvent.click(await screen.findByRole('button', { name: 'Uzavrieť zmenu' }));
  const sheet = await exportExcel();
  await userEvent.click(within(sheet).getByRole('button', { name: 'Zdieľať' }));
  expect(await within(sheet).findByText('Zdieľanie zlyhalo', {}, SLOW)).toBeInTheDocument();
  expect(within(sheet).getByRole('button', { name: 'Zdieľať' })).toBeEnabled();
});

/** A folder of the system picker, in memory. */
interface FakeDir {
  name: string;
  files: Map<string, Blob>;
  dirs: Map<string, FakeDir>;
  queryPermission(): Promise<PermissionState>;
  requestPermission?(): Promise<PermissionState>;
  getDirectoryHandle(n: string): Promise<FakeDir>;
  getFileHandle(n: string, o: { create: boolean }): Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;
}

describe('with a report folder chosen in settings', () => {
  const win = window as unknown as { showDirectoryPicker?: unknown };
  function fakeDir(name = 'REPORT_OBSADENOST'): FakeDir {
    const files = new Map<string, Blob>();
    const dirs = new Map<string, FakeDir>();
    return {
      name, files, dirs,
      queryPermission: vi.fn(async () => 'prompt' as PermissionState),
      requestPermission: vi.fn(async () => 'granted' as PermissionState),
      getDirectoryHandle: async (n: string) => {
        if (!dirs.has(n)) dirs.set(n, fakeDir(n));
        return dirs.get(n)!;
      },
      getFileHandle: vi.fn(async (fileName: string, o: { create: boolean }) => {
        if (!o.create && !files.has(fileName)) throw new DOMException('missing', 'NotFoundError');
        return { createWritable: async () => ({ write: async (b: Blob) => { files.set(fileName, b); }, close: async () => {} }) };
      }),
    };
  }
  afterEach(() => { delete win.showDirectoryPicker; });

  test('closing leaves the folder alone; Uložiť do priečinka puts the report into its month', async () => {
    const dir = fakeDir();
    win.showDirectoryPicker = vi.fn(async () => dir);
    await pickReportFolder(db);
    await openLayout();
    await userEvent.click(await screen.findByRole('button', { name: 'Uzavrieť zmenu' }));
    await screen.findByText(/Zmena je uzavretá/, {}, SLOW);
    expect(dir.dirs.size + dir.files.size).toBe(0); // nothing saved by itself
    const sheet = await exportExcel();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Uložiť do priečinka' }));
    expect(await within(sheet).findByText('Uložené do priečinka REPORT_OBSADENOST: 1 súbor.', {}, SLOW)).toBeInTheDocument();
    expect(dir.requestPermission).toHaveBeenCalled();
    expect([...dir.dirs.get('2026-11')!.files.keys()]).toEqual(['Obsadenost_2026-11-11_zmena-B.xlsx']);
  });
});

test('cancel keeps the shift open', async () => {
  await openLayout();
  await userEvent.click(await screen.findByRole('button', { name: 'Späť' }));
  expect(screen.queryByRole('dialog', { name: 'Uzavrieť zmenu' })).toBeNull();
  expect(await db.drafts.get('s-B')).toBeDefined();
});
