import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DBProvider } from '../useDB';
import { openDB, ensureSeeded, getMeta, type AppDB } from '../../db/db';
import { MachineEditor } from './MachineEditor';
import { PeopleSettings } from './PeopleSettings';
import { ShiftSettings } from './ShiftSettings';
import { BackupSettings } from './BackupSettings';
import { SettingsView } from './SettingsView';
import { HallSettings } from './HallSettings';
import { upsertPerson } from '../../db/repo';
import { shareOrDownload } from '../../report/share';
import { trackWeights } from '../grid';

vi.mock('../../report/share', () => ({ shareOrDownload: vi.fn(async () => 'downloaded') }));

let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = openDB(`set-${++n}-${Math.random()}`);
  await ensureSeeded(db);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
// Unmount first: live queries of still-mounted components must not hit a closed database.
afterEach(() => {
  cleanup();
  db.close();
  vi.restoreAllMocks();
});
const wrap = (ui: React.ReactNode) => render(<DBProvider db={db}>{ui}</DBProvider>);

test('appearance tab switches to dark mode and remembers it', async () => {
  delete document.documentElement.dataset.theme;
  wrap(<SettingsView onBack={() => {}} />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Vzhľad' }));
  const dark = await screen.findByRole('button', { name: 'Tmavý' });
  expect(await screen.findByRole('button', { name: 'Svetlý' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(dark);
  await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  expect(await getMeta(db, 'theme')).toBe('dark');
  await vi.waitFor(() => expect(dark).toHaveAttribute('aria-pressed', 'true'));
  await userEvent.click(screen.getByRole('button', { name: 'Podľa zariadenia' }));
  await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBe('system'));
});

describe('report folder settings', () => {
  const win = window as unknown as { showDirectoryPicker?: unknown };
  afterEach(() => { delete win.showDirectoryPicker; });

  test('without browser support it explains that sharing is used', async () => {
    wrap(<SettingsView onBack={() => {}} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Report' }));
    expect(await screen.findByText(/nevie ukladať priamo do priečinka/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vybrať priečinok' })).toBeNull();
  });

  test('a folder can be chosen and described', async () => {
    win.showDirectoryPicker = vi.fn(async () => ({ name: 'REPORT_OBSADENOST', getFileHandle: vi.fn() }));
    wrap(<SettingsView onBack={() => {}} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Report' }));
    expect(await screen.findByText('Priečinok zatiaľ nie je vybraný.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Vybrať priečinok' }));
    expect(await screen.findByText('REPORT_OBSADENOST')).toBeInTheDocument();
    const input = screen.getByLabelText('Cesta k priečinku (popis pre majstrov)');
    await userEvent.type(input, 'Q:\\REPORTY');
    await userEvent.click(screen.getByRole('button', { name: 'Uložiť popis' }));
    await vi.waitFor(async () => expect(await getMeta(db, 'reportFolderLabel')).toBe('Q:\\REPORTY'));
  });
});

test('machine editor renames the selected machine', async () => {
  wrap(<MachineEditor />);
  const before = (await db.machines.toArray()).find((m) => m.name === 'DMC 1035')!;
  await userEvent.click(await screen.findByRole('button', { name: /DMC 1035/ }));
  expect(screen.queryByRole('button', { name: /Posunúť/ })).toBeNull(); // moving is done by dragging
  const input = screen.getByLabelText('Názov stroja');
  await userEvent.clear(input);
  await userEvent.type(input, 'DMC 1035 V');
  await userEvent.click(screen.getByRole('button', { name: 'Uložiť názov' }));
  await vi.waitFor(async () => expect((await db.machines.get(before.id))!.name).toBe('DMC 1035 V'));
});

test('machine editor sets a nick for the tile', async () => {
  wrap(<MachineEditor />);
  const before = (await db.machines.toArray()).find((m) => m.name === 'HERMLE C60')!;
  await userEvent.click(await screen.findByRole('button', { name: /HERMLE C60/ }));
  const input = screen.getByLabelText(/Prezývka na dlaždici/);
  expect(input).toHaveAttribute('placeholder', 'C60'); // empty = automatic nick
  await userEvent.type(input, 'Šesťd.');
  await userEvent.click(screen.getByRole('button', { name: 'Uložiť názov' }));
  await vi.waitFor(async () => expect((await db.machines.get(before.id))!.nick).toBe('Šesťd.'));
});

test('machine editor: an emptied nick goes back to the automatic one', async () => {
  const c60 = (await db.machines.toArray()).find((m) => m.name === 'HERMLE C60')!;
  await db.machines.put({ ...c60, nick: 'Šesťd.' });
  wrap(<MachineEditor />);
  await userEvent.click(await screen.findByRole('button', { name: /HERMLE C60/ }));
  const input = screen.getByLabelText(/Prezývka na dlaždici/);
  expect(input).toHaveValue('Šesťd.');
  fireEvent.change(input, { target: { value: '' } });
  await userEvent.click(screen.getByRole('button', { name: 'Uložiť názov' }));
  await vi.waitFor(async () => expect((await db.machines.get(c60.id))!.nick).toBeUndefined());
});

test('the selected machine can be dragged with a finger', async () => {
  wrap(<MachineEditor />);
  const machines = await db.machines.toArray();
  const before = machines.find((m) => m.name === 'DMU 125')!; // x 6, y 4
  const tile = await screen.findByRole('button', { name: /DMU 125/ });
  const grid = tile.parentElement!;
  grid.style.gap = '0px';
  grid.style.padding = '0px';
  // Give the grid a real size: every column/row 10 px wide/high, so 1 unit = 10 px and no gaps.
  const { cols, rows } = trackWeights(machines);
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: sum(cols) * 10, height: sum(rows) * 10, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect,
  );
  const centre = (weights: number[], i: number) => (sum(weights.slice(0, i)) + weights[i] / 2) * 10;

  // not selected yet → dragging does nothing
  fireEvent.pointerDown(tile, { clientX: centre(cols, before.x), clientY: centre(rows, before.y), pointerId: 1 });
  fireEvent.pointerMove(tile, { clientX: centre(cols, before.x + 2), clientY: centre(rows, before.y), pointerId: 1 });
  fireEvent.pointerUp(tile, { pointerId: 1 });
  expect((await db.machines.get(before.id))!.x).toBe(before.x);

  await userEvent.click(tile); // select
  fireEvent.pointerDown(tile, { clientX: centre(cols, before.x), clientY: centre(rows, before.y), pointerId: 1 });
  fireEvent.pointerMove(tile, { clientX: centre(cols, before.x + 2), clientY: centre(rows, before.y + 1), pointerId: 1 });
  fireEvent.pointerUp(tile, { pointerId: 1 });
  await vi.waitFor(async () => expect(await db.machines.get(before.id)).toMatchObject({ x: before.x + 2, y: before.y + 1 }));
});

test('machine editor toggles out of service, adds and deletes a machine', async () => {
  wrap(<MachineEditor />);
  await userEvent.click(await screen.findByRole('button', { name: /HERMLE C60/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Mimo prevádzky' }));
  await vi.waitFor(async () => expect((await db.machines.get('m-0'))!.status).toBe('out_of_service'));
  await userEvent.click(screen.getByRole('button', { name: 'Pridať stroj' }));
  await vi.waitFor(async () => expect(await db.machines.count()).toBe(38));
  await userEvent.click(screen.getByRole('button', { name: 'Odstrániť stroj' }));
  await vi.waitFor(async () => expect(await db.machines.count()).toBe(37));
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

test('people settings set the role (frézar / operátor) when adding and editing', async () => {
  await upsertPerson(db, { name: 'Starý', shiftId: 's-B', active: true }); // no role from older data
  wrap(<PeopleSettings />);
  await userEvent.type(await screen.findByLabelText('Meno'), 'Horváth');
  await userEvent.selectOptions(screen.getByLabelText('Rola'), 'Operátor');
  await userEvent.click(screen.getByRole('button', { name: 'Pridať' }));
  await vi.waitFor(async () =>
    expect((await db.people.toArray()).find((p) => p.name === 'Horváth')?.role).toBe('operator'));

  const group = await screen.findByRole('region', { name: 'Zmena B' });
  expect(within(group).getByText('Frézar')).toBeInTheDocument(); // missing role shows as frézar
  await userEvent.click(within(group).getByRole('button', { name: 'Upraviť Starý' }));
  await userEvent.selectOptions(within(group).getByLabelText('Rola – Starý'), 'Operátor');
  await userEvent.click(within(group).getByRole('button', { name: 'Uložiť' }));
  await vi.waitFor(async () =>
    expect((await db.people.toArray()).find((p) => p.name === 'Starý')?.role).toBe('operator'));
});

test('people import of a per-shift sheet creates shifts and removes empty default ones', async () => {
  const csv = 'Smena Alfa;Smena Beta;Vsetci\nAdam;Cyril;Adam\n;;Fero\n';
  wrap(<PeopleSettings />);
  expect(await screen.findByLabelText(/Odstrániť prázdne zmeny/)).toBeChecked();
  await userEvent.upload(screen.getByLabelText(/Importovať zo súboru/), new File([csv], 'ludia.csv'));
  expect(await screen.findByText(/Pridaných 3, preskočených 0/)).toBeInTheDocument();
  expect(screen.getByText(/Vytvorené zmeny: Alfa, Beta, Ostatní/)).toBeInTheDocument();
  expect(screen.getByText(/Odstránené prázdne zmeny: A, B, C/)).toBeInTheDocument();
  expect(await screen.findByRole('region', { name: 'Ostatní' })).toHaveTextContent('Fero');
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

test('zones in settings: add and rename; a zone with machines cannot be removed', async () => {
  wrap(<HallSettings />);
  expect(await screen.findByLabelText('Názov oddelenia Frézovňa')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Odstrániť oddelenie HSC' })).toBeDisabled(); // has 2 machines
  await userEvent.type(screen.getByLabelText('Nové oddelenie'), 'Brúsky');
  await userEvent.click(screen.getByRole('button', { name: 'Pridať oddelenie' }));
  await vi.waitFor(async () => expect((await db.halls.orderBy('order').toArray()).map((h) => h.name)).toEqual(['Frézovňa', 'HSC', 'Brúsky']));
  expect(await screen.findByRole('button', { name: 'Odstrániť oddelenie Brúsky' })).toBeEnabled();
});

test('machine editor: pick a zone, its machines are shown; a machine can move to another zone', async () => {
  wrap(<MachineEditor />);
  await userEvent.click(await screen.findByRole('button', { name: 'HSC' }));
  await vi.waitFor(() => expect(screen.getAllByTestId('machine-tile')).toHaveLength(2));
  await userEvent.click(screen.getByRole('button', { name: /MIKRON \/ 2/ }));
  await userEvent.selectOptions(screen.getByLabelText('Oddelenie stroja'), 'frezy');
  await vi.waitFor(async () => expect((await db.machines.get('m-hsc-2'))!.hallId).toBe('frezy'));
  await vi.waitFor(() => expect(screen.getAllByTestId('machine-tile')).toHaveLength(36)); // now showing the milling hall
});

test('zones can be moved up and down; the first cannot go up, the last cannot go down', async () => {
  wrap(<HallSettings />);
  expect(await screen.findByRole('button', { name: 'Posunúť Frézovňa hore' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Posunúť HSC dole' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Posunúť HSC hore' }));
  await vi.waitFor(async () => expect((await db.halls.orderBy('order').toArray()).map((h) => h.name)).toEqual(['HSC', 'Frézovňa']));
  expect(await screen.findByRole('button', { name: 'Posunúť HSC hore' })).toBeDisabled();
});
