import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { DBProvider } from './useDB';
import { openDB, ensureSeeded, type AppDB } from '../db/db';
import { startDraft, setMachineType, togglePerson, upsertPerson } from '../db/repo';
import { shareOrDownload } from '../report/share';
import { pickReportFolder } from '../report/folder';

vi.mock('../report/share', () => ({ shareOrDownload: vi.fn(async () => 'shared') }));

let db: AppDB;
let n = 0;
beforeEach(async () => {
  vi.mocked(shareOrDownload).mockReset().mockResolvedValue('shared');
  db = openDB(`close-${++n}-${Math.random()}`);
  await ensureSeeded(db);
  const p = await upsertPerson(db, { name: 'Kováč', shiftId: 's-B', active: true });
  await startDraft(db, 's-B', 'Novák', new Date(2026, 10, 11, 14, 0));
  await setMachineType(db, 's-B', 'm-0', 'EXT');
  await togglePerson(db, 's-B', 'm-1', p); // people without type
});
afterEach(() => db.close());

async function openLayout() {
  render(<DBProvider db={db}><App /></DBProvider>);
  await userEvent.click(await screen.findByRole('button', { name: /^B/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Uzavrieť zmenu a vytvoriť report' }));
}

// Generating the report lazy-loads ExcelJS, which can be slow on a cold, busy test run.
const SLOW = { timeout: 8000 };

/** The share button is disabled until the Excel file is prepared. */
async function shareButtonReady() {
  const btn = await screen.findByRole('button', { name: 'Zdieľať report' }, SLOW);
  await vi.waitFor(() => expect(btn).toBeEnabled(), SLOW);
  return btn;
}

test('close dialog warns about machines with people but no type', async () => {
  await openLayout();
  const dialog = await screen.findByRole('dialog', { name: 'Uzavrieť zmenu' });
  expect(dialog).toHaveTextContent('1 stroj má ľudí bez farby');
});

test('closing saves the record, then sharing is its own tap, then back to picker', async () => {
  await openLayout();
  await userEvent.click(await screen.findByRole('button', { name: 'Uzavrieť zmenu' }));
  expect(await screen.findByText('Zmena je uzavretá a uložená v histórii.', {}, SLOW)).toBeInTheDocument();
  const records = await db.records.toArray();
  expect(records).toHaveLength(1);
  expect(records[0].stats.ext).toBe(1);
  expect(await db.drafts.get('s-B')).toBeUndefined();
  expect(shareOrDownload).not.toHaveBeenCalled();

  await userEvent.click(await shareButtonReady());
  await vi.waitFor(() =>
    expect(vi.mocked(shareOrDownload)).toHaveBeenCalledWith(expect.any(Blob), 'Obsadenost_Frezy_2026-11-11_zmena-B.xlsx'),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  expect(await screen.findByText('Vyber svoju zmenu')).toBeInTheDocument();
});

test('a failing share shows the error and keeps the dialog usable', async () => {
  vi.mocked(shareOrDownload).mockRejectedValueOnce(new Error('Zdieľanie zlyhalo'));
  await openLayout();
  await userEvent.click(await screen.findByRole('button', { name: 'Uzavrieť zmenu' }));
  await userEvent.click(await shareButtonReady());
  expect(await screen.findByText('Zdieľanie zlyhalo')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Zdieľať report' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Hotovo' })).toBeEnabled();
});

describe('with a report folder chosen in settings', () => {
  const win = window as unknown as { showDirectoryPicker?: unknown };
  function fakeDir(fail = false) {
    const files = new Map<string, Blob>();
    return {
      name: 'REPORT_OBSADENOST',
      files,
      queryPermission: vi.fn(async () => 'prompt' as PermissionState),
      requestPermission: vi.fn(async () => 'granted' as PermissionState),
      getFileHandle: vi.fn(async (fileName: string) => {
        if (fail) throw new DOMException('Sieť nedostupná', 'NotFoundError');
        return {
          createWritable: async () => {
            let data: Blob | null = null;
            return { write: async (b: Blob) => { data = b; }, close: async () => { files.set(fileName, data!); } };
          },
        };
      }),
    };
  }
  afterEach(() => { delete win.showDirectoryPicker; });

  test('closing the shift saves the report straight into the folder', async () => {
    const dir = fakeDir();
    win.showDirectoryPicker = vi.fn(async () => dir);
    await pickReportFolder(db);
    await openLayout();
    await userEvent.click(await screen.findByRole('button', { name: 'Uzavrieť zmenu' }));
    expect(await screen.findByText('Report uložený do priečinka REPORT_OBSADENOST.', {}, SLOW)).toBeInTheDocument();
    expect(dir.requestPermission).toHaveBeenCalled();
    expect([...dir.files.keys()]).toEqual(['Obsadenost_Frezy_2026-11-11_zmena-B.xlsx']);
    expect(shareOrDownload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Zdieľať report' })).toBeInTheDocument();
  });

  test('if the network folder is unavailable the shift is still closed and sharing is offered', async () => {
    win.showDirectoryPicker = vi.fn(async () => fakeDir(true));
    await pickReportFolder(db);
    await openLayout();
    await userEvent.click(await screen.findByRole('button', { name: 'Uzavrieť zmenu' }));
    expect(await screen.findByText(/nepodarilo uložiť do priečinka \(Sieť nedostupná\)/, {}, SLOW)).toBeInTheDocument();
    expect(await db.records.count()).toBe(1);
    expect(await shareButtonReady()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Uložiť do priečinka' })).toBeInTheDocument();
  });
});

test('cancel keeps the shift open', async () => {
  await openLayout();
  await userEvent.click(await screen.findByRole('button', { name: 'Späť' }));
  expect(screen.queryByRole('dialog', { name: 'Uzavrieť zmenu' })).toBeNull();
  expect(await db.drafts.get('s-B')).toBeDefined();
});
