import { compactLayout, isUniform } from './compact';
import { seedMachines } from './seed';

const seed = seedMachines('frezy');
const compact = compactLayout(seed);
const at = (name: string) => {
  const m = compact.find((x) => x.name === name)!;
  return [m.x, m.y];
};

test('every machine takes one cell and no two machines share a cell', () => {
  expect(compact).toHaveLength(seed.length);
  expect(isUniform(compact)).toBe(true);
  expect(new Set(compact.map((m) => `${m.x},${m.y}`)).size).toBe(seed.length);
  expect(compact.map((m) => m.id)).toEqual(seed.map((m) => m.id)); // same order, ids kept
});

test('the plan keeps its rows and the order of machines in them', () => {
  // first row of the hall, left to right
  const row0 = compact.filter((m) => m.y === 0).sort((a, b) => a.x - b.x).map((m) => m.name);
  expect(row0).toEqual([
    'HERMLE C60', 'HERMLE C42 / 4', 'HERMLE C42 / 1', 'DMU 80P HI-DYN', 'DMU 80P DUO BLOCK / 1',
    'DMU 60P DUO BLOCK', 'HERMLE C40 U / 1', 'HERMLE C40 U / 2', 'DMC 1035', 'CHIRON 800',
  ]);
  // DMU 125 and DMC 1150 / 2 start one row lower but belong to the second row of machines
  expect(at('DMU 125')[1]).toBe(1);
  expect(at('DMC 1150 / 2')[1]).toBe(1);
  expect(at('DMF 220 LINEAR')[1]).toBe(2);
  // machines in one column of the hall stay in one column
  expect(at('HERMLE C60')[0]).toBe(at('DMU 125')[0]);
  expect(at('HERMLE C42 / 4')[0]).toBe(at('HERMLE C42 / 2')[0]);
});

test('the aisle in front of the big machines stays as one empty row; machines in one spot get stacked', () => {
  const bigRow = at('SHW')[1];
  expect(bigRow).toBe(4); // rows 0–2 machines, row 3 aisle
  expect(compact.some((m) => m.y === 3)).toBe(false);
  expect(at('ZAYER')[1]).toBe(bigRow);
  expect(at('UNIPORT 4000')).toEqual([at('EDEL')[0], bigRow]);
  expect(at('EDEL')[1]).toBe(bigRow + 1);
  expect(at('SHW')[0]).toBe(0);
});

test('empty input and an already compact plan', () => {
  expect(compactLayout([])).toEqual([]);
  const row = [{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }];
  expect(compactLayout(row)).toEqual(row);
});
