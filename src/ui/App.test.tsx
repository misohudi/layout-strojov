import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { DBProvider } from './useDB';
import { openDB, ensureSeeded, type AppDB } from '../db/db';
import { startDraft, setMachinePriority, setMachineType, togglePerson, upsertPerson } from '../db/repo';

let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = openDB(`app-${++n}-${Math.random()}`);
  await ensureSeeded(db);
  localStorage.clear(); // the zone shown last is remembered per device
});
// Unmount first: live queries of still-mounted components must not hit a closed database.
afterEach(() => {
  cleanup();
  db.close();
});

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
  expect(within(header).getByRole('button', { name: 'Zmena B – zmeniť zmenu' })).toBeInTheDocument();
  expect(await screen.findAllByTestId('machine-tile')).toHaveLength(35);
  await userEvent.click(screen.getByRole('button', { name: /HERMLE C60/ }));
  await userEvent.click(screen.getByRole('button', { name: 'EXT' }));
  // order figures live in the legend now
  expect(await screen.findByRole('group', { name: 'Vyťaženie strojov 2,7 %' })).toBeInTheDocument(); // 1 / 37 (both zones)
  expect(screen.getByRole('button', { name: 'EXT – externá: 1, 100,0 %' })).toBeInTheDocument();
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
  expect(await within(header).findByRole('group', { name: 'Obsadenosť 5,4 %' })).toBeInTheDocument(); // 2 / 37
  expect(within(header).getByRole('button', { name: '2 / 37 strojov' })).toBeInTheDocument();
  expect(within(header).getByRole('group', { name: 'Frézari 1' })).toBeInTheDocument();
  expect(within(header).getByRole('group', { name: 'Operátori 1' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Vyťaženie strojov 0,0 %' })).toBeInTheDocument();
});

test('all machines are equally sized cells with a machine icon; the figure follows the role of the person', async () => {
  const p = await upsertPerson(db, { name: 'Kováč', shiftId: 's-B', active: true });
  const o = await upsertPerson(db, { name: 'Horváth', shiftId: 's-B', active: true, role: 'operator' });
  await startDraft(db, 's-B', 'B', new Date());
  await togglePerson(db, 's-B', 'm-0', p);
  await togglePerson(db, 's-B', 'm-1', o);
  renderApp();
  await pickShift('B');
  const tiles = await screen.findAllByTestId('machine-tile');
  expect(tiles.every((t) => t.style.gridColumn.endsWith('span 1') && t.style.gridRow.endsWith('span 1'))).toBe(true);
  const c60 = screen.getByRole('button', { name: /^HERMLE C60/ });
  expect(within(c60).getByTestId('icon-frezar')).toBeInTheDocument(); // standing
  const c42 = screen.getByRole('button', { name: /^HERMLE C42 \/ 4/ });
  expect(within(c42).getByTestId('icon-operator')).toBeInTheDocument(); // seated
  const dmu = screen.getByRole('button', { name: /^DMU 125/ });
  expect(within(dmu).getByTestId('icon-machine')).toBeInTheDocument();
  expect(screen.getAllByTestId('icon-frezar')).toHaveLength(1);
});

test('header groups related fields into sections', async () => {
  renderApp();
  await pickShift('B');
  const header = await screen.findByRole('banner');
  const section = (name: string) => within(header).getByRole('region', { name });
  // the shift itself is the button for switching shifts – no separate button
  expect(within(section('Zmena')).getAllByRole('button')).toHaveLength(1);
  expect(within(section('Zmena')).getByRole('button', { name: /^Zmena B/ })).toHaveTextContent('B');
  expect(within(section('Obsadenosť ľuďmi')).getByRole('group', { name: 'Frézari 0' })).toBeInTheDocument();
  expect(within(section('Obsadenosť ľuďmi')).getByRole('button', { name: '0 / 37 strojov' })).toBeInTheDocument();
  expect(within(section('Obsadenosť ľuďmi')).getByRole('group', { name: 'Viacobsluha 0 ľudí na 0 strojoch' })).toBeInTheDocument();
  expect(within(header).queryByRole('region', { name: 'Zákazky' })).toBeNull(); // moved to the legend
  expect(within(section('Aplikácia')).getByRole('button', { name: 'Nastavenia' })).toBeInTheDocument();
  // História and Nastavenia are icon-only buttons; viacobsluha shows a person and a machine icon
  for (const name of ['História', 'Nastavenia']) {
    const btn = within(section('Aplikácia')).getByRole('button', { name });
    expect(btn).toHaveTextContent(/^$/);
    expect(btn.querySelector('svg')).not.toBeNull();
  }
  const multi = within(header).getByRole('group', { name: /^Viacobsluha/ });
  expect(within(multi).getByTestId('icon-people')).toBeInTheDocument();
  expect(within(multi).getByTestId('icon-machines')).toBeInTheDocument();
  expect(multi).not.toHaveTextContent(/ľ|str/);
});

test('"Vyčistiť" empties the whole plan of the shift after confirmation', async () => {
  const p = await upsertPerson(db, { name: 'Kováč', shiftId: 's-B', active: true });
  await startDraft(db, 's-B', 'B', new Date());
  await setMachineType(db, 's-B', 'm-0', 'EXT');
  await togglePerson(db, 's-B', 'm-0', p);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  renderApp();
  await pickShift('B');
  const clear = await screen.findByRole('button', { name: 'Vyčistiť' });
  await userEvent.click(clear); // cancelled
  expect(Object.keys((await db.drafts.get('s-B'))!.assignments)).toHaveLength(1);
  await userEvent.click(clear);
  await vi.waitFor(async () => expect((await db.drafts.get('s-B'))!.assignments).toEqual({}));
  expect(confirm).toHaveBeenCalledTimes(2);
  const header = screen.getByRole('banner');
  expect(await within(header).findByRole('group', { name: 'Obsadenosť 0,0 %' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Vyčistiť' })).toBeDisabled(); // nothing left to clear
  expect(await db.drafts.get('s-B')).toMatchObject({ foremanName: 'B' }); // the shift stays open
  confirm.mockRestore();
});

test('legend shows counts and shares; tapping an item highlights its machines and greys out the rest', async () => {
  const p = await upsertPerson(db, { name: 'Kováč', shiftId: 's-B', active: true });
  await db.machines.update('m-5', { status: 'out_of_service' });
  await startDraft(db, 's-B', 'B', new Date());
  await setMachineType(db, 's-B', 'm-0', 'EXT');
  await setMachineType(db, 's-B', 'm-1', 'EXT');
  await setMachineType(db, 's-B', 'm-2', 'INT');
  await togglePerson(db, 's-B', 'm-0', p);
  await togglePerson(db, 's-B', 'm-1', p); // viacobsluha
  renderApp();
  await pickShift('B');
  const ext = await screen.findByRole('button', { name: 'EXT – externá: 2, 66,7 %' });
  expect(screen.getByRole('button', { name: 'INT – interná: 1, 33,3 %' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'voľný: 33' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'mimo prevádzky: 1' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Vyťaženie strojov 8,3 %' })).toBeInTheDocument(); // 3 / 36
  expect(within(screen.getByRole('banner')).getByRole('group', { name: 'Viacobsluha 1 ľudí na 2 strojoch' })).toBeInTheDocument();

  await userEvent.click(ext);
  expect(ext).toHaveAttribute('aria-pressed', 'true');
  const tiles = screen.getAllByTestId('machine-tile');
  expect(tiles.filter((t) => t.classList.contains('tile--hl'))).toHaveLength(2);
  expect(tiles.filter((t) => t.classList.contains('tile--dim'))).toHaveLength(33);
  await userEvent.click(ext); // again → back to normal
  expect(screen.getAllByTestId('machine-tile').some((t) => /tile--(hl|dim)/.test(t.className))).toBe(false);
});

test('"Vyčistiť" stands before "Uzavrieť zmenu"', async () => {
  renderApp();
  await pickShift('B');
  const clear = await screen.findByRole('button', { name: 'Vyčistiť' });
  const close = screen.getByRole('button', { name: 'Uzavrieť zmenu a vytvoriť report' });
  expect(clear.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('priority needs an order type; the tile gets a PRIO tag; a free machine loses it', async () => {
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: /^DMU 125/ }));
  const prio = () => within(screen.getByRole('dialog')).getByRole('button', { name: /prioritn/i });
  // no order type yet → priority can't be chosen
  expect(prio()).toBeDisabled();
  expect(screen.getByText('Prioritu môžete zvoliť až po výbere EXT alebo INT.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'INT' }));
  await userEvent.click(prio());
  expect(await screen.findByRole('button', { name: /PRIO/, pressed: true })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  const tile = screen.getByRole('button', { name: /^DMU 125/ });
  await vi.waitFor(() => expect(tile).toHaveClass('tile--priority'));
  expect(within(tile).getByText('PRIO')).toBeInTheDocument();
  // switching the machine to free drops the priority
  await userEvent.click(tile);
  await userEvent.click(screen.getByRole('button', { name: 'Voľný' }));
  await vi.waitFor(() => expect(prio()).toBeDisabled()); // the change is saved asynchronously
  await userEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  await vi.waitFor(() => expect(screen.getByRole('button', { name: /^DMU 125/ })).not.toHaveClass('tile--priority'));
  expect((await db.drafts.get('s-B'))!.assignments['m-17'].priority).toBeUndefined();
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
  // round back button with an arrow, in one row with the tabs
  const back = screen.getByRole('button', { name: 'Späť' });
  expect(back).toHaveTextContent(/^$/);
  expect(back.parentElement).toContainElement(screen.getByRole('tablist'));
  await userEvent.click(back);
  expect(await screen.findAllByTestId('machine-tile')).toHaveLength(35);
});

test('the start screen has the same icon-only gear button for settings', async () => {
  renderApp();
  const gear = await screen.findByRole('button', { name: 'Nastavenia' });
  expect(gear).toHaveTextContent(/^$/);
  expect(gear.querySelector('svg')).not.toBeNull();
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
  await userEvent.click(screen.getByRole('button', { name: 'Späť' }));
  await pickShift('B');
  const header = await screen.findByRole('banner');
  expect(await within(header).findByRole('button', { name: '0 / 36 strojov' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /HERMLE C42 \/ 4/ }));
  await userEvent.click(screen.getByRole('button', { name: 'EXT' }));
  expect(await screen.findByRole('group', { name: 'Vyťaženie strojov 2,8 %' })).toBeInTheDocument(); // 1 / 36
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
  await userEvent.click(await screen.findByRole('button', { name: '1 / 36 strojov' }));
  const list = await screen.findByRole('dialog', { name: 'Zoznam strojov' });
  const active = within(list).getByRole('table', { name: 'V prevádzke' });
  // machines of both zones, each zone under its heading
  const all = within(active).getAllByRole('row').slice(1);
  expect(all.filter((r) => r.classList.contains('machine-list__zone')).map((r) => r.textContent)).toEqual(['Frézovňa', 'HSC']);
  const rows = all.filter((r) => !r.classList.contains('machine-list__zone'));
  expect(rows).toHaveLength(36);
  const c60 = rows.find((r) => r.textContent!.includes('HERMLE C60'))!;
  expect(c60).toHaveTextContent('EXT');
  expect(c60).toHaveTextContent('Kováč');
  expect(rows.find((r) => r.textContent!.includes('HERMLE C42 / 1'))).toHaveTextContent('INT');
  expect(rows.find((r) => r.textContent!.includes('DMU 125'))).toHaveTextContent('voľný');
  expect(within(list).getByRole('table', { name: 'Mimo prevádzky' })).toHaveTextContent('HERMLE C42 / 4');
  expect(list).toHaveTextContent('Obsadenosť 2,8 %'); // 1 machine with people / 36
  expect(list).toHaveTextContent('Vyťaženie strojov 5,6 %');

  // tapping a row opens that machine for editing
  await userEvent.click(c60);
  expect(await screen.findByRole('dialog', { name: 'HERMLE C60' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Zoznam strojov' })).toBeNull();
});

test('a machine edited from the list returns to the list on "Hotovo", showing the change', async () => {
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: '0 / 37 strojov' }));
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
  await userEvent.click(screen.getByRole('button', { name: 'Späť' }));
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
  expect(await screen.findByRole('button', { name: 'INT – interná: 1, 100,0 %' })).toBeInTheDocument();
});

test('zones: the name is shown under the header; arrows and a swipe switch between them', async () => {
  renderApp();
  await pickShift('B');
  expect(await screen.findByRole('heading', { name: 'Frézovňa' })).toBeInTheDocument();
  expect(screen.getAllByTestId('machine-tile')).toHaveLength(35);
  expect(screen.getByRole('button', { name: /^Predchádzajúce oddelenie/ })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Ďalšie oddelenie – HSC' }));
  expect(await screen.findByRole('heading', { name: 'HSC' })).toBeInTheDocument();
  const hsc = screen.getAllByTestId('machine-tile');
  expect(hsc.map((t) => t.getAttribute('title'))).toEqual(['MIKRON / 1', 'MIKRON / 2']);
  // only two machines: enlarged over the whole plan, without the empty floor to their left
  expect(hsc.map((t) => t.style.gridColumn)).toEqual(['1 / span 1', '1 / span 1']);
  expect(screen.getByTestId('floor-scroll')).toHaveClass('floor__scroll--fill');
  // the header counts the whole department
  expect(within(screen.getByRole('banner')).getByRole('button', { name: '0 / 37 strojov' })).toBeInTheDocument();
  // swipe right → back to the milling hall
  const zone = screen.getByTestId('floor-scroll').closest('.zone')!;
  fireEvent.touchStart(zone, { touches: [{ clientX: 100, clientY: 300 }] });
  fireEvent.touchEnd(zone, { changedTouches: [{ clientX: 300, clientY: 310 }] });
  expect(await screen.findByRole('heading', { name: 'Frézovňa' })).toBeInTheDocument();
  // a mostly vertical move is not a swipe
  fireEvent.touchStart(zone, { touches: [{ clientX: 300, clientY: 100 }] });
  fireEvent.touchEnd(zone, { changedTouches: [{ clientX: 220, clientY: 400 }] });
  expect(screen.getByRole('heading', { name: 'Frézovňa' })).toBeInTheDocument();
});

const lastRecord = () =>
  db.records.put({
    id: 'r', shiftId: 's-A', shiftName: 'A', foremanName: 'X', date: '2026-11-10',
    startedAt: '2026-11-10T06:00:00Z', closedAt: '2026-11-10T14:00:00Z',
    stats: { total: 37, occupied: 1, ext: 1, int: 0, occupancyPct: 2.7, extPct: 100, intPct: 0, peopleWithoutType: 0 },
    rows: [{ machineName: 'HERMLE C60', type: 'EXT', priority: true, outOfService: false, people: [{ name: 'Kováč', homeShiftName: 'A', overtime: false }] }],
    layout: [],
  });

test('an empty plan offers the orders of the last shift on a card over the plan; it can be closed without taking over', async () => {
  await lastRecord();
  renderApp();
  await pickShift('B');
  const card = await screen.findByRole('status');
  expect(card.closest('.zone')).not.toBeNull(); // over the plan, not above it
  await userEvent.click(within(card).getByRole('button', { name: 'Zavrieť bez prevzatia' }));
  expect(screen.queryByRole('button', { name: /Prevziať/ })).toBeNull();
  expect((await db.drafts.get('s-B'))!.assignments).toEqual({});
});

test('taking over copies order types and priorities, not the people', async () => {
  await lastRecord();
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: 'Prevziať zakázky a priority z poslednej zmeny' }));
  await vi.waitFor(async () => expect((await db.drafts.get('s-B'))!.assignments['m-0']).toEqual({ type: 'EXT', personIds: [], priority: true }));
  await vi.waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});

test('the arrow to a zone not looked at yet pulses (yellow with a priority order) until the zone is opened', async () => {
  await startDraft(db, 's-B', 'Y', new Date());
  await setMachineType(db, 's-B', 'm-hsc-1', 'INT');
  await setMachinePriority(db, 's-B', 'm-hsc-1', true);
  renderApp();
  await pickShift('B');
  const next = await screen.findByRole('button', { name: 'Ďalšie oddelenie – HSC' });
  await vi.waitFor(() => expect(next).toHaveClass('zone__arrow--pulse', 'zone__arrow--prio'));
  await userEvent.click(next);
  const back = await screen.findByRole('button', { name: 'Predchádzajúce oddelenie – Frézovňa' });
  expect(back).not.toHaveClass('zone__arrow--pulse'); // the milling hall was already seen
  await userEvent.click(back);
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Ďalšie oddelenie – HSC' })).not.toHaveClass('zone__arrow--pulse'));
});

test('legend: when only another zone has such machines, the view switches there', async () => {
  await startDraft(db, 's-B', 'Y', new Date());
  await setMachineType(db, 's-B', 'm-hsc-2', 'INT'); // the only INT machine is in HSC
  renderApp();
  await pickShift('B');
  expect(await screen.findByRole('heading', { name: 'Frézovňa' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /^INT – interná/ }));
  expect(await screen.findByRole('heading', { name: 'HSC' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^MIKRON \/ 2/ })).toHaveClass('tile--hl');
});

test('legend: with such machines here and in another zone, the arrow to that zone lights up', async () => {
  await startDraft(db, 's-B', 'Y', new Date());
  for (const id of ['m-0', 'm-hsc-1']) {
    await setMachineType(db, 's-B', id, 'EXT');
    await setMachinePriority(db, 's-B', id, true);
  }
  renderApp();
  await pickShift('B');
  await userEvent.click(await screen.findByRole('button', { name: 'Ďalšie oddelenie – HSC' })); // seen
  await userEvent.click(await screen.findByRole('button', { name: 'Predchádzajúce oddelenie – Frézovňa' }));
  const next = await screen.findByRole('button', { name: 'Ďalšie oddelenie – HSC' });
  await vi.waitFor(() => expect(next).not.toHaveClass('zone__arrow--pulse'));
  await userEvent.click(screen.getByRole('button', { name: /^prioritná zákazka/ }));
  expect(screen.getByRole('heading', { name: 'Frézovňa' })).toBeInTheDocument(); // stays: C60 is here
  expect(next).toHaveClass('zone__arrow--hl', 'zone__arrow--hl-prio');
});
