import { computeStats } from './stats';
import type { Machine } from './types';

const mk = (id: string, status: Machine['status'] = 'active'): Machine => ({
  id, hallId: 'frezy', name: id, x: 0, y: 0, w: 1, h: 1, status,
});
const machines = [mk('a'), mk('b'), mk('c'), mk('d'), mk('oos', 'out_of_service')];

test('counts only active machines, ext/int share of occupied', () => {
  const s = computeStats(machines, {
    a: { type: 'EXT', personIds: [] },
    b: { type: 'EXT', personIds: [] },
    c: { type: 'INT', personIds: [] },
    oos: { type: 'EXT', personIds: [] },
  });
  expect(s).toEqual({
    total: 4, occupied: 3, ext: 2, int: 1,
    occupancyPct: 75, extPct: 67, intPct: 33, peopleWithoutType: 0,
  });
});

test('no assignments: occupancy 0, ext/int null', () => {
  const s = computeStats(machines, {});
  expect(s.occupancyPct).toBe(0);
  expect(s.extPct).toBeNull();
  expect(s.intPct).toBeNull();
});

test('no active machines: occupancy null', () => {
  expect(computeStats([mk('x', 'out_of_service')], {}).occupancyPct).toBeNull();
});

test('people without type do not count as occupied', () => {
  const s = computeStats(machines, { a: { type: null, personIds: ['p1'] } });
  expect(s.occupied).toBe(0);
  expect(s.peopleWithoutType).toBe(1);
});

test('assignment for unknown machine is ignored', () => {
  const s = computeStats(machines, { zzz: { type: 'EXT', personIds: ['p'] } });
  expect(s.occupied).toBe(0);
  expect(s.peopleWithoutType).toBe(0);
});
