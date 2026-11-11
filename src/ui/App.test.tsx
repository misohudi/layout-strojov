import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { DBProvider } from './useDB';
import { openDB, ensureSeeded, type AppDB } from '../db/db';
import { startDraft, setMachineType } from '../db/repo';

let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = openDB(`app-${++n}-${Math.random()}`);
  await ensureSeeded(db);
});
afterEach(() => db.close());

const renderApp = () => render(<DBProvider db={db}><App /></DBProvider>);

async function pickShift(name: string, foreman: string) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }));
  const input = screen.getByLabelText('Meno majstra');
  await userEvent.clear(input);
  await userEvent.type(input, foreman);
  await userEvent.click(screen.getByRole('button', { name: 'Pokračovať' }));
}

test('pick shift, mark machine EXT, header shows stats', async () => {
  renderApp();
  await pickShift('B', 'Novák');
  const header = await screen.findByRole('banner');
  expect(within(header).getByText('Zmena B · Novák')).toBeInTheDocument();
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
  await pickShift('B', 'Novák');
  await userEvent.click(await screen.findByRole('button', { name: 'Uložiť zálohu teraz' }));
  expect(await screen.findByRole('tab', { name: 'Záloha', selected: true })).toBeInTheDocument();
});

test('no backup banner without any records', async () => {
  renderApp();
  await pickShift('B', 'Novák');
  await screen.findAllByTestId('machine-tile');
  expect(screen.queryByText(/Odporúčame uložiť zálohu/)).toBeNull();
});

test('settings open from the header and go back', async () => {
  renderApp();
  await pickShift('B', 'Novák');
  await userEvent.click(await screen.findByRole('button', { name: 'Nastavenia' }));
  expect(await screen.findByRole('heading', { name: 'Nastavenia' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '← Späť' }));
  expect(await screen.findAllByTestId('machine-tile')).toHaveLength(35);
});

test('if the open shift draft disappears (shift deleted / backup restored) the user can get back to the picker', async () => {
  renderApp();
  await pickShift('B', 'Novák');
  await screen.findAllByTestId('machine-tile');
  await db.drafts.delete('s-B');
  expect(await screen.findByText('Táto zmena už nie je otvorená.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Vybrať zmenu' }));
  expect(await screen.findByText('Vyber svoju zmenu')).toBeInTheDocument();
});

test('continue button disabled without foreman name', async () => {
  renderApp();
  await userEvent.click(await screen.findByRole('button', { name: /^A/ }));
  expect(screen.getByRole('button', { name: 'Pokračovať' })).toBeDisabled();
});

test('existing draft offers to continue', async () => {
  await startDraft(db, 's-A', 'Kráľ', new Date(2026, 10, 10, 22, 0));
  await setMachineType(db, 's-A', 'm-0', 'INT');
  renderApp();
  await pickShift('A', 'Kráľ');
  expect(await screen.findByText(/Rozpracované od 10\.11\. 22:00/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Pokračovať v rozpracovanej' }));
  const header = await screen.findByRole('banner');
  expect(await within(header).findByText('INT 100 %')).toBeInTheDocument();
});
