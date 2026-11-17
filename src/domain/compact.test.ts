import { hallLayout, isUniform, moveToCell } from './compact';
import { seedMachines } from './seed';

const seed = seedMachines('frezy');
const plan = hallLayout(seed);
const at = (name: string) => {
  const m = plan.find((x) => x.name === name)!;
  return [m.x, m.y];
};

test('every machine takes one cell and no two machines share a cell; ids and order kept', () => {
  expect(plan).toHaveLength(seed.length);
  expect(isUniform(plan)).toBe(true);
  expect(new Set(plan.map((m) => `${m.x},${m.y}`)).size).toBe(seed.length);
  expect(plan.map((m) => m.id)).toEqual(seed.map((m) => m.id));
});

test('machines above each other in the hall stay in one column; rows of the hall stay', () => {
  const row0 = plan.filter((m) => m.y === 0).sort((a, b) => a.x - b.x).map((m) => m.name);
  expect(row0).toEqual([
    'HERMLE C60', 'HERMLE C42 / 4', 'HERMLE C42 / 1', 'DMU 80P HI-DYN', 'DMU 80P DUO BLOCK / 1',
    'DMU 60P DUO BLOCK', 'HERMLE C40 U / 1', 'HERMLE C40 U / 2', 'DMC 1035', 'CHIRON 800',
  ]);
  expect(at('DMU 125')[1]).toBe(1); // one hall row lower, still with its neighbours
  expect(at('HERMLE C60')[0]).toBe(at('DMU 125')[0]);
  expect(at('HERMLE C42 / 4')[0]).toBe(at('HERMLE C42 / 2')[0]);
  expect(at('DMF 220 LINEAR')[1]).toBe(2);
});

test('gaps stay empty and the aisle in front of the big machines stays as an empty row', () => {
  // HERMLE C40 U / 2 has no machine below it in the second row
  const c40 = at('HERMLE C40 U / 2')[0];
  expect(plan.some((m) => m.x === c40 && m.y === 1)).toBe(false);
  const bigRow = at('SHW')[1];
  expect(bigRow).toBe(4); // rows 0–2 machines, row 3 aisle
  expect(plan.some((m) => m.y === 3)).toBe(false);
  expect(at('UNIPORT 4000')).toEqual([at('EDEL')[0], bigRow]);
  expect(at('EDEL')[1]).toBe(bigRow + 1); // same hall column → stacked
});

test('empty input and an already compact plan', () => {
  expect(hallLayout([])).toEqual([]);
  const row = [{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }];
  expect(hallLayout(row)).toEqual(row);
});

const cell = (id: string, x: number, y: number) => ({ id, x, y, w: 1, h: 1 });

test('moveToCell: to an empty cell moves, onto another machine swaps them', () => {
  const items = [cell('a', 0, 0), cell('b', 1, 0)];
  expect(moveToCell(items, 'a', 3, 2)).toEqual([cell('a', 3, 2)]);
  expect(moveToCell(items, 'a', 1, 0)).toEqual([cell('a', 1, 0), cell('b', 0, 0)]);
  expect(moveToCell(items, 'a', 0, 0)).toEqual([]);
});
