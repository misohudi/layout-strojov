import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DBProvider } from '../useDB';
import { openDB, ensureSeeded, getMeta, type AppDB } from '../../db/db';
import { MachineEditor } from './MachineEditor';
import { PeopleSettings } from './PeopleSettings';
import { ShiftSettings } from './ShiftSettings';
import { BackupSettings } from './BackupSettings';
import { upsertPerson } from '../../db/repo';
import { shareOrDownload } from '../../report/share';

vi.mock('../../report/share', () => ({ shareOrDownload: vi.fn(async () => 'downloaded') }));

let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = openDB(`set-${++n}-${Math.random()}`);
  await ensureSeeded(db);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});
const wrap = (ui: React.ReactNode) => render(<DBProvider db={db}>{ui}</DBProvider>);

test('machine editor moves and renames the selected machine', async () => {
  wrap(<MachineEditor />);
  const before = (await db.machines.toArray()).find((m) => m.name === 'DMC 1035')!;
  await userEvent.click(await screen.findByRole('button', { name: /DMC 1035/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Posunúť doprava' }));
  await vi.waitFor(async () => expect((await db.machines.get(before.id))!.x).toBe(before.x + 1));
  const input = screen.getByLabelText('Názov stroja');
  await userEvent.clear(input);
  await userEvent.type(input, 'DMC 1035 V');
  await userEvent.click(screen.getByRole('button', { name: 'Uložiť názov' }));
  await vi.waitFor(async () => expect((await db.machines.get(before.id))!.name).toBe('DMC 1035 V'));
});

test('machine editor toggles out of service, adds and deletes a machine', async () => {
  wrap(<MachineEditor />);
  await userEvent.click(await screen.findByRole('button', { name: /HERMLE C60/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Mimo prevádzky' }));
  await vi.waitFor(async () => expect((await db.machines.get('m-0'))!.status).toBe('out_of_service'));
  await userEvent.click(screen.getByRole('button', { name: 'Pridať stroj' }));
  await vi.waitFor(async () => expect(await db.machines.count()).toBe(36));
  await userEvent.click(screen.getByRole('button', { name: 'Odstrániť stroj' }));
  await vi.waitFor(async () => expect(await db.machines.count()).toBe(35));
});

test('people settings add a person to a shift', async () => {
  wrap(<PeopleSettings />);
  await userEvent.type(await screen.findByLabelText('Meno'), 'Kováč');
  await userEvent.selectOptions(screen.getByLabelText('Zmena'), 'A');
  await userEvent.click(screen.getByRole('button', { name: 'Pridať' }));
  const group = await screen.findByRole('region', { name: 'Zmena A' });
  expect(within(group).getByText('Kováč')).toBeInTheDocument();
  expect((await db.people.toArray()).map((p) => [p.name, p.shiftId])).toEqual([['Kováč', 's-A']]);
});

test('people settings deactivate and delete', async () => {
  const id = await upsertPerson(db, { name: 'Horváth', shiftId: 's-B', active: true });
  wrap(<PeopleSettings />);
  await userEvent.click(await screen.findByRole('button', { name: 'Deaktivovať Horváth' }));
  await vi.waitFor(async () => expect((await db.people.get(id))!.active).toBe(false));
  await userEvent.click(screen.getByRole('button', { name: 'Odstrániť Horváth' }));
  await vi.waitFor(async () => expect(await db.people.get(id)).toBeUndefined());
});

test('shift settings show an error when deleting a shift with people', async () => {
  await upsertPerson(db, { name: 'Horváth', shiftId: 's-A', active: true });
  wrap(<ShiftSettings />);
  await userEvent.click(await screen.findByRole('button', { name: 'Odstrániť zmenu A' }));
  expect(await screen.findByText('Zmena má priradených ľudí')).toBeInTheDocument();
});

test('saving a backup shares the file and records the time', async () => {
  wrap(<BackupSettings />);
  await userEvent.click(await screen.findByRole('button', { name: 'Uložiť zálohu' }));
  await vi.waitFor(() =>
    expect(vi.mocked(shareOrDownload)).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^zaloha-layout-strojov-/)),
  );
  await vi.waitFor(async () => expect(await getMeta(db, 'lastBackupAt')).toBeDefined());
});
