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
  // Wait until the shift's plan is open – the start screen also has a "Nastavenia" button,
  // so acting earlier could hit the wrong screen on a slow machine (CI).
  await screen.findByRole('banner', {}, { timeout: 5000 });
}

test('pick shift, mark machine EXT, header shows order stats as secondary', async () => {
  renderApp();
  await pickShift('B');
  const header = await screen.findByRole('banner');
  expect(within(header).getByRole('group', { name: 'Zmena B' })).toBeInTheDocument();
  expect(await screen.findAllByTestId('machine-tile')).toHaveLength(35);
  await userEvent.click(screen.getByRole('button', { name: /HERMLE C60/ }));
  await userEvent.click(screen.getByRole('button', { name: 'EXT' }));
  expect(await within(header).findByRole('group', { name: 'Zákazky 2,9 %' })).toBeInTheDocument();
  expect(within(header).getByRole('group', { name: 'EXT 100,0 %' })).toBeInTheDocument();
  // no people yet – occupancy by people stays at zero
  expect(within(header).getByRole('group', { name: 'Obsadenosť 0,0 %' })).toBeInTheDocument();
});

test('header occupancy counts machines with people and people by role', async () => {
  const f = await upsertPerson(db, { name: 'Kováč', shiftId: 's-B', active: true, role: 'frezar' });
  const o = await upsertPerson(db, { name: 'Horváth', shiftId: 's-B', active: true, role: 'operator' });
  await startDraft(db, 's-B', 'B', new Date());
  await togglePerson(db, 's-B', 'm-0', f);
  await togglePerson(db, 's-B', 'm-0', o);
  await togglePerson(db, 's-B', 'm-1', f);
  renderApp();
  await pickShift('B');
  const header = await screen.findByRole('banner');
  expect(await within(header).findByRole('group', { name: 'Obsadenosť 5,7 %' })).toBeInTheDocument(); // 2 / 35
  expect(within(header).getByRole('button', { name: '2 / 35 strojov' })).toBeInTheDocument();
  expect(within(header).getByRole('group', { name: 'Frézari 1' })).toBeInTheDocument();
  expect(within(header).getByRole('group', { name: 'Operátori 1' })).toBeInTheDocument();
  expect(within(header).getByRole('group', { name: 'Zákazky 0,0 %' })).toBeInTheDocument();
});

test('all machines are equally sized cells with a machine icon; a person turns it into a staffed machine', async () => {
  const p = await upsertPerson(db, { name: 'Kováč', shiftId: 's-B', active: true });
  await startDraft(db, 's-B', 'B', new Date());
  await togglePerson(db, 's-B', 'm-0', p);
  renderApp();
  await pickShift('B');
  const tiles = await screen.findAllByTestId('machine-tile');
  expect(tiles.every((t) => t.style.gridColumn.endsWith('span 1') && t.style.gridRow.endsWith('span 1'))).toBe(true);
  const c60 = screen.getByRole('button', { name: /^HERMLE C60/ });
  expect(within(c60).getByTestId('icon-staffed')).toBeInTheDocument();
  const dmu = screen.getByRole('button', { name: /^DMU 125/ });
  expect(within(dmu).getByTestId('icon-machine')).toBeInTheDocument();
  expect(screen.getAllByTestId('icon-staffed')).toHaveLength(1);
});

test('a machine marked as priority order gets a frame on the plan', async () => {
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: /^DMU 125/ }));
  await userEvent.click(screen.getByRole('button', { name: /Označiť ako prioritnú zákazku/ }));
  expect(await screen.findByRole('button', { name: /Prioritná zákazka/, pressed: true })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  const tile = screen.getByRole('button', { name: /^DMU 125/ });
  expect(tile).toHaveClass('tile--priority');
  // turning it off removes the frame
  await userEvent.click(tile);
  await userEvent.click(screen.getByRole('button', { name: /Prioritná zákazka/, pressed: true }));
  await userEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  expect(screen.getByRole('button', { name: /^DMU 125/ })).not.toHaveClass('tile--priority');
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
  expect(await within(header).findByRole('button', { name: '0 / 34 strojov' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /HERMLE C42 \/ 4/ }));
  await userEvent.click(screen.getByRole('button', { name: 'EXT' }));
  expect(await within(header).findByRole('group', { name: 'Zákazky 2,9 %' })).toBeInTheDocument(); // 1 / 34
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
  await userEvent.click(await screen.findByRole('button', { name: '1 / 34 strojov' }));
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
  expect(list).toHaveTextContent('Obsadenosť 2,9 %'); // 1 machine with people / 34
  expect(list).toHaveTextContent('Zákazky 5,9 %');

  // tapping a row opens that machine for editing
  await userEvent.click(c60);
  expect(await screen.findByRole('dialog', { name: 'HERMLE C60' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Zoznam strojov' })).toBeNull();
});

test('a machine edited from the list returns to the list on "Hotovo", showing the change', async () => {
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: '0 / 35 strojov' }));
  const list = await screen.findByRole('dialog', { name: 'Zoznam strojov' });
  const row = within(list).getAllByRole('row').find((r) => r.textContent!.includes('DMU 125'))!;
  await userEvent.click(row);
  await userEvent.click(await screen.findByRole('button', { name: 'INT' }));
  await userEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  const back = await screen.findByRole('dialog', { name: 'Zoznam strojov' });
  const updated = within(back).getAllByRole('row').find((r) => r.textContent!.includes('DMU 125'))!;
  expect(updated).toHaveTextContent('INT');
  // closing the list itself goes back to the plan
  await userEvent.click(within(back).getByRole('button', { name: 'Zavrieť' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a machine opened from the plan closes back to the plan on "Hotovo"', async () => {
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: /DMU 125/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Hotovo' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('five taps on empty space of the plan show the easter egg', async () => {
  renderApp();
  await pickShift('B');
  const plan = await screen.findByTestId('floor-scroll');
  for (let i = 0; i < 5; i++) await userEvent.click(plan);
  expect(await screen.findByRole('img', { name: 'Prekvapenie' })).toBeInTheDocument();
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
  expect(await within(header).findByRole('group', { name: 'INT 100,0 %' })).toBeInTheDocument();
});
