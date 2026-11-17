import { compactLayout, isPacked, packRows } from './compact';
import { seedMachines } from './seed';

const seed = seedMachines('frezy');
const compact = compactLayout(seed);
const row = (y: number) => compact.filter((m) => m.y === y).sort((a, b) => a.x - b.x).map((m) => m.name);

test('every machine takes one cell, rows are packed without gaps, ids and order kept', () => {
  expect(compact).toHaveLength(seed.length);
  expect(isPacked(compact)).toBe(true);
  expect(compact.map((m) => m.id)).toEqual(seed.map((m) => m.id));
});

test('rows of the hall stay, machines follow left to right next to each other', () => {
  expect(row(0)).toEqual([
    'HERMLE C60', 'HERMLE C42 / 4', 'HERMLE C42 / 1', 'DMU 80P HI-DYN', 'DMU 80P DUO BLOCK / 1',
    'DMU 60P DUO BLOCK', 'HERMLE C40 U / 1', 'HERMLE C40 U / 2', 'DMC 1035', 'CHIRON 800',
  ]);
  expect(row(1)).toEqual([
    'DMU 125', 'HERMLE C42 / 2', 'HERMLE C42 / 3', 'DMU 60P HIDYN', 'DMU 80P DUO BLOCK / 2',
    'DMU 80P DUO BLOCK / 3', 'HERMLE 1200 V', 'DMC 65H', 'DMC 1150 / 2',
  ]);
  expect(row(2)).toEqual([
    'DMC 80 U', 'HERMLE C32 / 1', 'HERMLE C32 / 2', 'HERMLE C32 / 3', 'HERMLE C32 / 4', 'HERMLE C32 / 5',
    'HERMLE C32 / 6', 'HERMLE C42 / 5', 'HERMLE C42 / 6', 'DMF 220 LINEAR', 'DMC 1150 / 1',
  ]);
  expect(row(3)).toEqual(['SHW', 'ZAYER', 'DMF 360', 'UNIPORT 4000', 'EDEL']);
  expect(compact.some((m) => m.y > 3)).toBe(false);
});

const cell = (id: string, x: number, y: number) => ({ id, x, y, w: 1, h: 1 });

test('packRows: moving right onto a neighbour swaps them, moving left too', () => {
  const r = [cell('a', 0, 0), cell('b', 1, 0), cell('c', 2, 0)];
  const right = packRows([{ ...r[0], x: 1 }, r[1], r[2]], { id: 'a', dx: 1 });
  expect(right.map((i) => [i.id, i.x])).toEqual([['a', 1], ['b', 0], ['c', 2]]);
  const left = packRows([r[0], r[1], { ...r[2], x: 1 }], { id: 'c', dx: -1 });
  expect(left.map((i) => [i.id, i.x])).toEqual([['a', 0], ['b', 2], ['c', 1]]);
});

test('packRows: moving down inserts into the next row, empty rows disappear, a new row can be made', () => {
  const r = [cell('a', 0, 0), cell('b', 0, 1), cell('c', 1, 1)];
  const down = packRows([{ ...r[0], y: 1 }, r[1], r[2]], { id: 'a', dx: 0 });
  expect(down.map((i) => [i.id, i.x, i.y])).toEqual([['a', 0, 0], ['b', 1, 0], ['c', 2, 0]]);
  const newRow = packRows([r[0], r[1], { ...r[2], y: 2, x: 5 }], { id: 'c', dx: 0 });
  expect(newRow.map((i) => [i.id, i.x, i.y])).toEqual([['a', 0, 0], ['b', 0, 1], ['c', 0, 2]]);
});

test('compactLayout of an already packed plan keeps it; empty input', () => {
  expect(compactLayout(compact)).toEqual(compact);
  expect(compactLayout([])).toEqual([]);
});
