import { buildShiftRecord, localDate } from './record';
import { computeStats } from './stats';
import { seedHalls, seedHscMachines, seedMachines, seedShifts } from './seed';
import type { Person, ShiftDraft } from './types';

const shifts = seedShifts();
const [A, B] = shifts;
const machines = seedMachines('frezy').map((m) => (m.id === 'm-1' ? { ...m, status: 'out_of_service' as const } : m));
const people: Person[] = [
  { id: 'p1', name: 'Kováč', shiftId: B.id, active: true },
  { id: 'p2', name: 'Horváth', shiftId: A.id, active: true, role: 'operator' },
];
const draft: ShiftDraft = {
  shiftId: B.id,
  foremanName: 'Novák',
  startedAt: new Date(2026, 10, 10, 22, 0).toISOString(),
  assignments: {
    'm-0': { type: 'EXT', personIds: ['p1', 'p2', 'gone'] },
    'm-1': { type: 'INT', personIds: ['p1'] },
  },
};
const build = () =>
  buildShiftRecord({ draft, shift: B, machines, people, shifts, now: new Date(2026, 10, 11, 6, 0), id: 'r1' });

test('date is the local date the shift started', () => {
  expect(localDate(new Date(2026, 10, 10, 22, 0).toISOString())).toBe('2026-11-10');
  expect(build().date).toBe('2026-11-10');
});

test('people from other shifts are marked as overtime; missing people are skipped', () => {
  const row = build().rows.find((r) => r.machineName === 'HERMLE C60')!;
  expect(row.people).toEqual([
    { name: 'Kováč', homeShiftName: 'B', overtime: false, role: 'frezar' },
    { name: 'Horváth', homeShiftName: 'A', overtime: true, role: 'operator' },
  ]);
});

test('people from the pool ("Ostatní") are not counted as overtime', () => {
  const pool = { id: 'pool', name: 'Ostatní', order: 9, kind: 'pool' as const };
  const r = buildShiftRecord({
    draft: { ...draft, assignments: { 'm-0': { type: 'EXT', personIds: ['o1'] } } },
    shift: B,
    machines,
    people: [{ id: 'o1', name: 'Ondrej', shiftId: 'pool', active: true }],
    shifts: [...shifts, pool],
    now: new Date(),
    id: 'r3',
  });
  expect(r.rows[0].people).toEqual([{ name: 'Ondrej', homeShiftName: 'Ostatní', overtime: false, role: 'frezar' }]);
});

test('out-of-service machines are last with no type and no people', () => {
  const r = build();
  expect(r.rows).toHaveLength(35);
  expect(r.rows[34]).toEqual({ machineName: 'HERMLE C42 / 4', type: null, outOfService: true, people: [] });
});

test('stats equal computeStats of the draft', () => {
  const s = build().stats;
  expect(s).toEqual(computeStats(machines, draft.assignments, people));
  expect(s).toMatchObject({ staffed: 1, frezari: 1, operatori: 1 });
});

test('header fields and layout', () => {
  const r = build();
  expect(r).toMatchObject({ id: 'r1', shiftId: B.id, shiftName: 'B', foremanName: 'Novák', startedAt: draft.startedAt });
  expect(r.closedAt).toBe(new Date(2026, 10, 11, 6, 0).toISOString());
  expect(r.layout).toHaveLength(35);
  expect(r.layout.find((l) => l.name === 'HERMLE C60')).toMatchObject({ type: 'EXT', outOfService: false, x: 6, y: 0 });
  expect(r.layout.find((l) => l.name === 'HERMLE C42 / 4')).toMatchObject({ type: null, outOfService: true });
});

test('record is a snapshot independent of later edits', () => {
  const ppl = people.map((p) => ({ ...p }));
  const r = buildShiftRecord({ draft, shift: B, machines, people: ppl, shifts, now: new Date(), id: 'r2' });
  ppl[0].name = 'Premenovaný';
  expect(r.rows[0].people[0].name).toBe('Kováč');
});

test('priority order is kept in rows and layout of active machines', () => {
  const r = buildShiftRecord({
    draft: { ...draft, assignments: { ...draft.assignments, 'm-0': { type: 'EXT', personIds: [], priority: true } } },
    shift: B, machines, people, shifts, now: new Date(), id: 'r4',
  });
  expect(r.rows.find((x) => x.machineName === 'HERMLE C60')!.priority).toBe(true);
  expect(r.layout.find((l) => l.name === 'HERMLE C60')!.priority).toBe(true);
  expect(r.layout.find((l) => l.name === 'DMU 125')!.priority).toBe(false);
});

test('with several zones, rows and the plan remember the zone; rows go zone by zone', () => {
  const r = buildShiftRecord({
    draft, shift: B, machines: [...seedHscMachines(), ...machines], people, shifts, halls: seedHalls(),
    now: new Date(2026, 10, 11, 6, 0), id: 'r2',
  });
  const active = r.rows.filter((x) => !x.outOfService);
  expect(active[0]).toMatchObject({ machineName: 'HERMLE C60', hallName: 'Frézovňa' });
  expect(active.slice(-2).map((x) => [x.machineName, x.hallName])).toEqual([['MIKRON / 1', 'HSC'], ['MIKRON / 2', 'HSC']]);
  expect(r.layout.find((l) => l.name === 'MIKRON / 1')).toMatchObject({ hallId: 'hsc', hallName: 'HSC', x: 12, y: 0 });
});
