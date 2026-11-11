import { seedMachines, seedShifts, HALL_FREZY } from './seed';

test('seedMachines returns the 35 milling machines from sheet "frezy"', () => {
  const m = seedMachines(HALL_FREZY);
  expect(m).toHaveLength(35);
  expect(new Set(m.map((x) => x.name)).size).toBe(35);
  expect(new Set(m.map((x) => x.id)).size).toBe(35);
  expect(m.find((x) => x.name === 'SHW')).toMatchObject({ x: 0, y: 11, w: 5, h: 7 });
  expect(m.find((x) => x.name === 'HERMLE C60')).toMatchObject({ x: 6, y: 0, w: 3, h: 3 });
  expect(m.find((x) => x.name === 'EDEL')).toBeDefined();
  expect(m.find((x) => x.name === 'DMU 80P HI-DYN')).toBeDefined();
  expect(m.every((x) => x.status === 'active' && x.hallId === 'frezy')).toBe(true);
});

test('seedShifts returns A, B, C in order', () => {
  expect(seedShifts().map((s) => [s.name, s.order])).toEqual([
    ['A', 0],
    ['B', 1],
    ['C', 2],
  ]);
});
