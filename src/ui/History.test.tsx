import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryView } from './HistoryView';
import { DBProvider } from './useDB';
import { openDB, ensureSeeded, type AppDB } from '../db/db';
import { saveRecordAndReset } from '../db/repo';
import type { ShiftRecord } from '../domain/types';
import { downloadBlob, shareOrDownloadFiles } from '../report/share';
import { pickReportFolder } from '../report/folder';

vi.mock('../report/share', () => ({ shareOrDownload: vi.fn(async () => 'shared'), shareOrDownloadFiles: vi.fn(async () => 'shared'), downloadBlob: vi.fn() }));
vi.mock('../report/pdf', () => ({ buildRecordsPdf: vi.fn(async () => new Blob(['%PDF'])), pdfFileName: (r: unknown[]) => (r.length === 1 ? 'one.pdf' : 'Historia_layoutov.pdf') }));

const rec = (id: string, shiftId: string, shiftName: string, date: string): ShiftRecord => ({
  id, shiftId, shiftName, foremanName: 'Novák', date,
  startedAt: `${date}T06:00:00.000Z`, closedAt: `${date}T14:00:00.000Z`,
  stats: { total: 35, occupied: 7, ext: 4, int: 3, occupancyPct: 20, extPct: 57, intPct: 43, peopleWithoutType: 0 },
  rows: [{ machineName: 'HERMLE C60', type: 'EXT', outOfService: false, people: [] }],
  layout: [{ name: 'HERMLE C60', x: 0, y: 0, w: 1, h: 1, type: 'EXT', outOfService: false }],
});

let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = openDB(`hist-${++n}-${Math.random()}`);
  await ensureSeeded(db);
  await saveRecordAndReset(db, rec('r1', 's-A', 'A', '2026-11-09'));
  await saveRecordAndReset(db, rec('r2', 's-B', 'B', '2026-11-10'));
  render(<DBProvider db={db}><HistoryView onBack={() => {}} /></DBProvider>);
});
// Unmount first: live queries of still-mounted components must not hit a closed database.
afterEach(() => {
  cleanup();
  db.close();
});

/** Opens Exportovať and ticks the given file types; returns the export sheet. */
async function exportSheet(types: ('Excel' | 'PDF')[]) {
  await userEvent.click(screen.getByRole('button', { name: 'Exportovať' }));
  const sheet = await screen.findByRole('dialog', { name: 'Exportovať' });
  for (const t of types) await userEvent.click(within(sheet).getByRole('checkbox', { name: new RegExp(`^${t}`) }));
  return sheet;
}
const shared = () => vi.mocked(shareOrDownloadFiles).mock.calls.at(-1)![0].map((f) => f.name);

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

test('lists records newest first and filters by shift', async () => {
  await screen.findByText('10.11.2026');
  expect(bodyRows()).toHaveLength(2);
  expect(bodyRows()[0]).toHaveTextContent('B');
  await userEvent.selectOptions(screen.getByLabelText('Zmena'), 'A');
  expect(bodyRows()).toHaveLength(1);
  expect(bodyRows()[0]).toHaveTextContent('9.11.2026');
});

test('history and the shift detail have the same round back button as the settings', async () => {
  expect(screen.getByRole('button', { name: 'Späť' })).toHaveClass('chip--round');
  await userEvent.click(await screen.findByText('10.11.2026'));
  expect(await screen.findByRole('button', { name: 'Späť' })).toHaveClass('chip--round');
});

test('history has no foreman column; the shift detail shows occupancy big, as in the PDF, without the foreman', async () => {
  await screen.findByText('10.11.2026');
  expect(within(screen.getByRole('table')).queryByRole('columnheader', { name: 'Majster' })).toBeNull();
  expect(screen.queryByText('Novák')).toBeNull();
  await userEvent.click(screen.getByText('10.11.2026'));
  expect(await screen.findByRole('group', { name: /^Obsadenosť/ })).toBeInTheDocument();
  expect(screen.queryByText(/Majster/)).toBeNull();
  expect(screen.getByText(/Vyťaženie strojov 20,0 %/)).toBeInTheDocument();
});

test('export: the file types are always chosen first; nothing can go anywhere before', async () => {
  await screen.findByText('10.11.2026');
  await userEvent.click(screen.getByRole('button', { name: 'Exportovať' }));
  const sheet = await screen.findByRole('dialog', { name: 'Exportovať' });
  for (const b of ['Uložiť do priečinka', 'Stiahnuť', 'Zdieľať']) expect(within(sheet).getByRole('button', { name: b })).toBeDisabled();
  expect(within(sheet).getByRole('checkbox', { name: /^Excel/ })).not.toBeChecked();
  expect(within(sheet).getByRole('checkbox', { name: /^PDF/ })).not.toBeChecked();
});

test('several shifts downloaded or shared: asks for one overview or a file per shift', async () => {
  await screen.findByText('10.11.2026');
  const sheet = await exportSheet(['Excel', 'PDF']);
  const share = within(sheet).getByRole('button', { name: 'Zdieľať' });
  expect(share).toBeDisabled(); // not chosen yet
  await userEvent.click(within(sheet).getByRole('radio', { name: 'Spoločný súbor' }));
  await userEvent.click(share);
  await vi.waitFor(() => expect(shared()).toEqual([expect.stringMatching(/^Historia_obsadenosti_.*\.xlsx$/), 'Historia_layoutov.pdf']));
  await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Exportovať' })).toBeNull());
  const again = await exportSheet(['Excel']);
  await userEvent.click(within(again).getByRole('radio', { name: 'Za každú zmenu' }));
  await userEvent.click(within(again).getByRole('button', { name: 'Stiahnuť' }));
  await vi.waitFor(() => expect(vi.mocked(downloadBlob).mock.calls.map((c) => c[1])).toEqual(
    expect.arrayContaining(['Obsadenost_2026-11-10_zmena-B.xlsx', 'Obsadenost_2026-11-09_zmena-A.xlsx']),
  ));
});

test('a single shift: Excel and PDF share one name', async () => {
  await userEvent.click(await screen.findByText('10.11.2026'));
  const sheet = await exportSheet(['Excel', 'PDF']);
  expect(within(sheet).queryByRole('radio')).toBeNull(); // one shift – nothing to ask
  await userEvent.click(within(sheet).getByRole('button', { name: 'Zdieľať' }));
  await vi.waitFor(() => expect(shared()).toEqual(['Obsadenost_2026-11-10_zmena-B.xlsx', 'Obsadenost_2026-11-10_zmena-B.pdf']));
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

/** A folder of the system picker in memory, with subfolders. */
function fakeDir(name = 'REPORT_OBSADENOST', fail = false): FakeDir {
  const files = new Map<string, Blob>();
  const dirs = new Map<string, FakeDir>();
  const dir = {
    name, files, dirs,
    queryPermission: async () => 'granted' as PermissionState,
    getDirectoryHandle: async (n: string) => {
      if (fail) throw new DOMException('Sieť nedostupná', 'NotFoundError');
      if (!dirs.has(n)) dirs.set(n, fakeDir(n));
      return dirs.get(n)!;
    },
    getFileHandle: async (fileName: string, o: { create: boolean }) => {
      if (fail) throw new DOMException('Sieť nedostupná', 'NotFoundError');
      if (!o.create && !files.has(fileName)) throw new DOMException('missing', 'NotFoundError');
      return { createWritable: async () => ({ write: async (b: Blob) => { files.set(fileName, b); }, close: async () => {} }) };
    },
  };
  return dir;
}

test('into the report folder: every shift its own files in its month, an existing file only after asking', async () => {
  const dir = fakeDir();
  (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker = async () => dir;
  await pickReportFolder(db);
  await screen.findByText('10.11.2026');
  let sheet = await exportSheet(['Excel']);
  await userEvent.click(within(sheet).getByRole('button', { name: 'Uložiť do priečinka' }));
  expect(await within(sheet).findByText('Uložené do priečinka REPORT_OBSADENOST: 2 súbory.', {}, { timeout: 8000 })).toBeInTheDocument();
  expect([...dir.dirs.keys()]).toEqual(['2026-11']);
  expect([...dir.dirs.get('2026-11')!.files.keys()].sort()).toEqual(['Obsadenost_2026-11-09_zmena-A.xlsx', 'Obsadenost_2026-11-10_zmena-B.xlsx']);
  // again: both are there – asked; kept
  await userEvent.click(within(sheet).getByRole('button', { name: 'Uložiť do priečinka' }));
  const ask = await within(sheet).findByRole('alertdialog', { name: 'Súbory už existujú' }, { timeout: 8000 });
  expect(ask).toHaveTextContent('2026-11/Obsadenost_2026-11-10_zmena-B.xlsx');
  await userEvent.click(within(ask).getByRole('button', { name: 'Ponechať' }));
  expect(await within(sheet).findByText(/0 súborov \(2 súbory ponechaných bez zmeny\)/)).toBeInTheDocument();
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
});

test('report folder not reachable: the error offers to try again, download or share', async () => {
  (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker = async () => fakeDir('REPORT_OBSADENOST', true);
  await pickReportFolder(db);
  await userEvent.click(await screen.findByText('10.11.2026'));
  const sheet = await exportSheet(['Excel']);
  await userEvent.click(within(sheet).getByRole('button', { name: 'Uložiť do priečinka' }));
  const err = await within(sheet).findByRole('alert', {}, { timeout: 8000 });
  expect(err).toHaveTextContent(/nepodarilo uložiť do priečinka \(Sieť nedostupná\)/);
  await userEvent.click(within(err).getByRole('button', { name: 'Zdieľať' }));
  await vi.waitFor(() => expect(shared()).toEqual(['Obsadenost_2026-11-10_zmena-B.xlsx']));
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
});

test('without a report folder, saving into it is not offered', async () => {
  await userEvent.click(await screen.findByText('10.11.2026'));
  const sheet = await exportSheet(['Excel']);
  expect(within(sheet).getByRole('button', { name: 'Uložiť do priečinka' })).toBeDisabled();
  expect(sheet).toHaveTextContent('Priečinok pre reporty nastavíte v Nastaveniach → Report.');
});
