import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeoplePicker } from './PeoplePicker';
import { seedShifts } from '../domain/seed';
import type { Person } from '../domain/types';

const shifts = seedShifts();
const people: Person[] = [
  { id: 'b2', name: 'Zelený', shiftId: 's-B', active: true },
  { id: 'b1', name: 'Adam', shiftId: 's-B', active: true },
  { id: 'b3', name: 'Neaktívny', shiftId: 's-B', active: false },
  { id: 'a1', name: 'Baláž', shiftId: 's-A', active: true },
  { id: 'c1', name: 'Cibuľa', shiftId: 's-C', active: true },
];

test('own shift people come first, sorted; inactive hidden', () => {
  render(<PeoplePicker people={people} shifts={shifts} currentShiftId="s-B" selected={[]} onToggle={() => {}} />);
  const text = document.body.textContent!;
  expect(text.indexOf('Adam')).toBeLessThan(text.indexOf('Zelený'));
  expect(text.indexOf('Zelený')).toBeLessThan(text.indexOf('Iné zmeny (nadčas)'));
  expect(screen.queryByText('Neaktívny')).toBeNull();
  expect(screen.queryByText('Baláž')).toBeNull(); // collapsed
});

test('expanding shows other shifts grouped in order', async () => {
  render(<PeoplePicker people={people} shifts={shifts} currentShiftId="s-B" selected={[]} onToggle={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /Iné zmeny \(nadčas\)/ }));
  const text = document.body.textContent!;
  expect(text.indexOf('Zmena A')).toBeLessThan(text.indexOf('Baláž'));
  expect(text.indexOf('Baláž')).toBeLessThan(text.indexOf('Zmena C'));
  expect(screen.getByText('Cibuľa')).toBeInTheDocument();
});

test('selected person from another shift stays visible when collapsed', () => {
  render(<PeoplePicker people={people} shifts={shifts} currentShiftId="s-B" selected={['a1']} onToggle={() => {}} />);
  expect(screen.getByLabelText(/Baláž/)).toBeChecked();
});

test('shows on how many machines a person already works', () => {
  render(
    <PeoplePicker people={people} shifts={shifts} currentShiftId="s-B" selected={[]} counts={{ b1: 2 }} onToggle={() => {}} />,
  );
  expect(screen.getByLabelText(/Adam/)).toBeInTheDocument();
  expect(screen.getByText('2 stroje')).toBeInTheDocument();
});

test('toggling calls onToggle with the person id', async () => {
  const onToggle = vi.fn();
  render(<PeoplePicker people={people} shifts={shifts} currentShiftId="s-B" selected={[]} onToggle={onToggle} />);
  await userEvent.click(screen.getByLabelText('Adam'));
  expect(onToggle).toHaveBeenCalledWith('b1');
});
