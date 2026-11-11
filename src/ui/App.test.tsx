import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { DBProvider } from './useDB';
import { openDB, ensureSeeded, type AppDB } from '../db/db';
import { startDraft, setMachineType, togglePerson, upsertPerson } from '../db/repo';

let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = openDB(`app-${++n}-${Math.random()}`);
  await ensureSeeded(db);
});
afterEach(() => db.close());

const renderApp = () => render(<DBProvider db={db}><App /></DBProvider>);

/** One tap on the shift opens it – no foreman name to type. */
async function pickShift(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }));
}

test('pick shift, mark machine EXT, header shows stats', async () => {
  renderApp();
  await pickShift('B');
  const header = await screen.findByRole('banner');
  expect(within(header).getByText('Zmena B')).toBeInTheDocument();
  expect(await screen.findAllByTestId('machine-tile')).toHaveLength(35);
  await userEvent.click(screen.getByRole('button', { name: /HERMLE C60/ }));
  await userEvent.click(screen.getByRole('button', { name: 'EXT' }));
  expect(await within(header).findByText('Obsadenosť 3 %')).toBeInTheDocument();
  expect(within(header).getByText('EXT 100 %')).toBeInTheDocument();
});

test('backup banner shows when records exist and no recent backup; opens backup settings', async () => {
  await db.records.put({
    id: 'r', shiftId: 's-A', shiftName: 'A', foremanName: 'X', date: '2026-11-10',
    startedAt: '2026-11-10T06:00:00Z', closedAt: '2026-11-10T14:00:00Z',
    stats: { total: 35, occupied: 0, ext: 0, int: 0, occupancyPct: 0, extPct: null, intPct: null, peopleWithoutType: 0 },
    rows: [], layout: [],
  });
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: 'Uložiť zálohu teraz' }));
  expect(await screen.findByRole('tab', { name: 'Záloha', selected: true })).toBeInTheDocument();
});

test('no backup banner without any records', async () => {
  renderApp();
  await pickShift('B');
  await screen.findAllByTestId('machine-tile');
  expect(screen.queryByText(/Odporúčame uložiť zálohu/)).toBeNull();
});

test('settings open from the header and go back', async () => {
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: 'Nastavenia' }));
  expect(await screen.findByRole('heading', { name: 'Nastavenia' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '← Späť' }));
  expect(await screen.findAllByTestId('machine-tile')).toHaveLength(35);
});

test('if the open shift draft disappears (shift deleted / backup restored) the user can get back to the picker', async () => {
  renderApp();
  await pickShift('B');
  await screen.findAllByTestId('machine-tile');
  await db.drafts.delete('s-B');
  expect(await screen.findByText('Táto zmena už nie je otvorená.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Vybrať zmenu' }));
  expect(await screen.findByText('Vyber svoju zmenu')).toBeInTheDocument();
});

test('the pool ("Ostatní") is not offered as a shift on the start screen', async () => {
  await db.shifts.put({ id: 'pool', name: 'Ostatní', order: 9, kind: 'pool' });
  renderApp();
  expect(await screen.findByRole('button', { name: /^A/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Ostatní/ })).toBeNull();
});

test('a machine set out of service in settings is not counted in occupancy', async () => {
  renderApp();
  await userEvent.click(await screen.findByRole('button', { name: 'Nastavenia' }));
  await userEvent.click(await screen.findByRole('tab', { name: 'Stroje' }));
  await userEvent.click(await screen.findByRole('button', { name: /HERMLE C60/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Mimo prevádzky' }));
  await vi.waitFor(async () => expect((await db.machines.get('m-0'))!.status).toBe('out_of_service'));
  await userEvent.click(screen.getByRole('button', { name: '← Späť' }));
  await pickShift('B');
  const header = await screen.findByRole('banner');
  expect(await within(header).findByText('0 / 34 strojov')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /HERMLE C42 \/ 4/ }));
  await userEvent.click(screen.getByRole('button', { name: 'EXT' }));
  expect(await within(header).findByText('Obsadenosť 3 %')).toBeInTheDocument(); // 1 / 34
});

test('tapping the machine count opens a list of machines with order type and people', async () => {
  const p = await upsertPerson(db, { name: 'Kováč', shiftId: 's-B', active: true });
  await db.machines.update('m-1', { status: 'out_of_service' });
  await startDraft(db, 's-B', 'B', new Date());
  await setMachineType(db, 's-B', 'm-0', 'EXT');
  await togglePerson(db, 's-B', 'm-0', p);
  await setMachineType(db, 's-B', 'm-2', 'INT');
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: '2 / 34 strojov' }));
  const list = await screen.findByRole('dialog', { name: 'Zoznam strojov' });
  const active = within(list).getByRole('table', { name: 'V prevádzke' });
  const rows = within(active).getAllByRole('row').slice(1);
  expect(rows).toHaveLength(34);
  const c60 = rows.find((r) => r.textContent!.includes('HERMLE C60'))!;
  expect(c60).toHaveTextContent('EXT');
  expect(c60).toHaveTextContent('Kováč');
  expect(rows.find((r) => r.textContent!.includes('HERMLE C42 / 1'))).toHaveTextContent('INT');
  expect(rows.find((r) => r.textContent!.includes('DMU 125'))).toHaveTextContent('voľný');
  expect(within(list).getByRole('table', { name: 'Mimo prevádzky' })).toHaveTextContent('HERMLE C42 / 4');
  expect(list).toHaveTextContent('Obsadenosť 6 %');

  // tapping a row opens that machine for editing
  await userEvent.click(c60);
  expect(await screen.findByRole('dialog', { name: 'HERMLE C60' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Zoznam strojov' })).toBeNull();
});

test('start screen has no foreman name field', async () => {
  renderApp();
  await screen.findByRole('button', { name: /^A/ });
  expect(screen.queryByLabelText('Meno majstra')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Pokračovať' })).toBeNull();
});

test('settings are reachable from the start screen and a renamed shift shows there', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderApp();
  await userEvent.click(await screen.findByRole('button', { name: 'Nastavenia' }));
  await userEvent.click(await screen.findByRole('tab', { name: 'Zmeny' }));
  const input = await screen.findByLabelText('Názov zmeny A');
  await userEvent.clear(input);
  await userEvent.type(input, 'Kráľ');
  await userEvent.click(screen.getAllByRole('button', { name: 'Uložiť' })[0]);
  await userEvent.click(screen.getByRole('button', { name: '← Späť' }));
  expect(await screen.findByText('Vyber svoju zmenu')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /^Kráľ/ })).toBeInTheDocument();
});

test('a new draft records the shift name as the foreman', async () => {
  renderApp();
  await pickShift('C');
  await screen.findAllByTestId('machine-tile');
  expect((await db.drafts.get('s-C'))?.foremanName).toBe('C');
});

test('tapping a shift with an open draft continues it directly', async () => {
  await startDraft(db, 's-A', 'Kráľ', new Date(2026, 10, 10, 22, 0));
  await setMachineType(db, 's-A', 'm-0', 'INT');
  renderApp();
  await pickShift('A');
  const header = await screen.findByRole('banner');
  expect(await within(header).findByText('INT 100 %')).toBeInTheDocument();
});
