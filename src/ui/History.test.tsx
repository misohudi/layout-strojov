import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryView } from './HistoryView';
import { DBProvider } from './useDB';
import { openDB, ensureSeeded, type AppDB } from '../db/db';
import { saveRecordAndReset } from '../db/repo';
import type { ShiftRecord } from '../domain/types';
import { shareOrDownload } from '../report/share';
import { pickReportFolder } from '../report/folder';

vi.mock('../report/share', () => ({ shareOrDownload: vi.fn(async () => 'shared') }));

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
afterEach(() => db.close());

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

test('lists records newest first and filters by shift', async () => {
  await screen.findByText('10.11.2026');
  expect(bodyRows()).toHaveLength(2);
  expect(bodyRows()[0]).toHaveTextContent('B');
  await userEvent.selectOptions(screen.getByLabelText('Zmena'), 'A');
  expect(bodyRows()).toHaveLength(1);
  expect(bodyRows()[0]).toHaveTextContent('9.11.2026');
});

test('exports filtered records to Excel', async () => {
  await screen.findByText('10.11.2026');
  await userEvent.click(screen.getByRole('button', { name: 'Exportovať do Excelu' }));
  await vi.waitFor(() => expect(vi.mocked(shareOrDownload)).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^Historia_obsadenosti_.*\.xlsx$/)));
});

test('detail shows the record and can share its report', async () => {
  await userEvent.click(await screen.findByText('10.11.2026'));
  expect(await screen.findByRole('heading', { name: /Zmena B · 10\.11\.2026/ })).toBeInTheDocument();
  const share = screen.getByRole('button', { name: 'Zdieľať report' });
  expect(share).toBeDisabled(); // file is prepared first so sharing happens directly in the tap
  await vi.waitFor(() => expect(share).toBeEnabled(), { timeout: 8000 });
  await userEvent.click(share);
  await vi.waitFor(() => expect(vi.mocked(shareOrDownload)).toHaveBeenCalledWith(expect.any(Blob), 'Obsadenost_Frezy_2026-11-10_zmena-B.xlsx'));
});

test('detail can save its report into the report folder', async () => {
  const files = new Map<string, Blob>();
  const dir = {
    name: 'REPORT_OBSADENOST',
    queryPermission: async () => 'granted' as PermissionState,
    getFileHandle: async (fileName: string) => ({
      createWritable: async () => ({ write: async (b: Blob) => { files.set(fileName, b); }, close: async () => {} }),
    }),
  };
  (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker = async () => dir;
  await pickReportFolder(db);
  await userEvent.click(await screen.findByText('9.11.2026'));
  const save = await screen.findByRole('button', { name: 'Uložiť do priečinka' });
  await vi.waitFor(() => expect(save).toBeEnabled(), { timeout: 8000 });
  await userEvent.click(save);
  expect(await screen.findByText('Report uložený do priečinka REPORT_OBSADENOST.')).toBeInTheDocument();
  expect([...files.keys()]).toEqual(['Obsadenost_Frezy_2026-11-09_zmena-A.xlsx']);
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
});

test('without a report folder the detail offers only sharing', async () => {
  await userEvent.click(await screen.findByText('10.11.2026'));
  await screen.findByRole('button', { name: 'Zdieľať report' });
  expect(screen.queryByRole('button', { name: 'Uložiť do priečinka' })).toBeNull();
});
