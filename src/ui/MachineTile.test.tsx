import { render, screen, within } from '@testing-library/react';
import { MachineTile, splitName } from './MachineTile';

const base = { x: 0, y: 0, w: 1, h: 1, type: null, outOfService: false } as const;

test('splitName keeps normal names on one line and moves the end of the longest to a second line', () => {
  expect(splitName('HERMLE C60')).toEqual(['HERMLE C60', null]);
  expect(splitName('DMF 220 LINEAR')).toEqual(['DMF 220 LINEAR', null]);
  expect(splitName('DMU 80P DUO BLOCK / 1')).toEqual(['DMU 80P', 'DUO BLOCK / 1']);
  expect(splitName('DMU 60P DUO BLOCK')).toEqual(['DMU 60P', 'DUO BLOCK']);
  expect(splitName('VERYLONGNAMEWITHOUTSPACES')).toEqual(['VERYLONGNAMEWITHOUTSPACES', null]);
});

test('free machine: icon on the left, name, no person', () => {
  render(<MachineTile {...base} name="DMU 125" />);
  const tile = screen.getByTestId('machine-tile');
  expect(tile.firstElementChild).toBe(within(tile).getByTestId('icon-machine'));
  expect(tile).toHaveTextContent(/^DMU 125$/);
  expect(tile.querySelector('.tile__role')).toBeNull();
});

test('first person with role below and a count of the others; staffed icon', () => {
  render(
    <MachineTile
      {...base}
      name="DMU 80P DUO BLOCK / 1"
      people={[{ name: 'Kováč', role: 'operator' }, { name: 'Horváth' }, { name: 'Baláž' }]}
    />,
  );
  const tile = screen.getByTestId('machine-tile');
  expect(within(tile).getByTestId('icon-operator')).toBeInTheDocument(); // first person is an operator → seated
  expect(tile.querySelector('.tile__name')).toHaveTextContent('DMU 80P');
  expect(tile.querySelector('.tile__name-sub')).toHaveTextContent('DUO BLOCK / 1');
  expect(tile.querySelector('.tile__person-name')).toHaveTextContent('Kováč');
  expect(tile.querySelector('.tile__more')).toHaveTextContent('+2');
  expect(tile.querySelector('.tile__role')).toHaveTextContent('Operátor');
  expect(tile).not.toHaveTextContent('Horváth');
});

test('a person without a role shows as Frézar; one person has no count', () => {
  render(<MachineTile {...base} name="HERMLE C60" people={[{ name: 'Kováč' }]} />);
  const tile = screen.getByTestId('machine-tile');
  expect(tile.querySelector('.tile__role')).toHaveTextContent('Frézar');
  expect(within(tile).getByTestId('icon-frezar')).toBeInTheDocument(); // standing
  expect(tile.querySelector('.tile__more')).toBeNull();
});

test('priority order: PRIO tag only with an order type and not out of service', () => {
  const { rerender } = render(<MachineTile {...base} type="INT" name="HERMLE C60" priority />);
  let tile = screen.getByTestId('machine-tile');
  expect(tile).toHaveClass('tile--priority');
  expect(tile.querySelector('.prio-badge')).toHaveTextContent(/^PRIO/);
  rerender(<MachineTile {...base} name="HERMLE C60" priority />); // free machine
  tile = screen.getByTestId('machine-tile');
  expect(tile.querySelector('.prio-badge')).toBeNull();
  rerender(<MachineTile {...base} type="EXT" name="HERMLE C60" priority outOfService />);
  tile = screen.getByTestId('machine-tile');
  expect(tile).not.toHaveClass('tile--priority');
  expect(tile.querySelector('.prio-badge')).toBeNull();
});

test('priority order without anyone on the machine shows a warning triangle', () => {
  const { rerender } = render(<MachineTile {...base} type="EXT" name="HERMLE C60" priority />);
  expect(screen.getByTitle('Prioritná zákazka bez obsluhy')).toBeInTheDocument();
  rerender(<MachineTile {...base} type="EXT" name="HERMLE C60" priority people={[{ name: 'Kováč' }]} />);
  expect(screen.queryByTitle('Prioritná zákazka bez obsluhy')).toBeNull();
  rerender(<MachineTile {...base} type="EXT" name="HERMLE C60" />); // no priority, no warning
  expect(screen.queryByTitle('Prioritná zákazka bez obsluhy')).toBeNull();
});

test('viacobsluha: a person on several machines gets a "2×" badge', () => {
  render(<MachineTile {...base} name="HERMLE C60" people={[{ name: 'Kováč', machines: 2 }]} />);
  expect(screen.getByTestId('machine-tile').querySelector('.tile__multi')).toHaveTextContent('2×');
});

test('machine out of service: grey icon with a minus sign; legend highlight classes', () => {
  const { rerender } = render(<MachineTile {...base} name="ZAYER" outOfService />);
  expect(within(screen.getByTestId('machine-tile')).getByTestId('icon-oos')).toBeInTheDocument();
  rerender(<MachineTile {...base} name="ZAYER" highlighted />);
  expect(screen.getByTestId('machine-tile')).toHaveClass('tile--hl');
  rerender(<MachineTile {...base} name="ZAYER" dimmed />);
  expect(screen.getByTestId('machine-tile')).toHaveClass('tile--dim');
});
