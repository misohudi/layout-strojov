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
