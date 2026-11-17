import { openDB, ensureSeeded, type AppDB } from './db';
import {
  getDraft, startDraft, continueDraft, getLastForeman, setMachineType, togglePerson, copyFromLastRecord,
  upsertPerson, deletePerson, setPersonActive, upsertMachine, addMachine, deleteMachine,
  upsertShift, deleteShift, saveRecordAndReset, listRecords,
} from './repo';
import type { ShiftRecord } from '../domain/types';
import { seedMachines } from '../domain/seed';
import { isPacked } from '../domain/compact';

let n = 0;
let dbName: string;
let db: AppDB;
const NOW = new Date('2026-11-11T06:00:00');

beforeEach(async () => {
  dbName = `test-${++n}-${Math.random()}`;
  db = openDB(dbName);
  await ensureSeeded(db);
});
afterEach(() => db.close());

const record = (over: Partial<ShiftRecord> = {}): ShiftRecord => ({
  id: 'r1', shiftId: 's-A', shiftName: 'A', foremanName: 'Novák', date: '2026-11-10',
  startedAt: '2026-11-10T06:00:00.000Z', closedAt: '2026-11-10T14:00:00.000Z',
  stats: { total: 35, occupied: 1, ext: 1, int: 0, occupancyPct: 3, extPct: 100, intPct: 0, peopleWithoutType: 0 },
  rows: [{ machineName: 'HERMLE C60', type: 'EXT', outOfService: false, people: [{ name: 'Kováč', homeShiftName: 'A', overtime: false }] }],
  layout: [],
  ...over,
});

test('ensureSeeded is idempotent', async () => {
  await ensureSeeded(db);
  expect(await db.machines.count()).toBe(35);
  expect(await db.shifts.count()).toBe(3);
});

test('a tablet that already had layout version 2 gets the hall rows back (EDEL next to UNIPORT)', async () => {
  // version 2 put EDEL alone in a row under UNIPORT 4000
  const edel = (await db.machines.toArray()).find((m) => m.name === 'EDEL')!;
  await db.machines.update(edel.id, { x: 11, y: 5, status: 'out_of_service' });
  await db.meta.put({ key: 'layoutVersion', value: 2 });
  await ensureSeeded(db);
  const ms = await db.machines.toArray();
  const uniport = ms.find((m) => m.name === 'UNIPORT 4000')!;
  expect(ms.find((m) => m.name === 'EDEL')).toMatchObject({ y: uniport.y, x: uniport.x + 1, status: 'out_of_service' });
  expect(Math.max(...ms.map((m) => m.y))).toBe(3);
});

test('a new install gets the compact layout: every machine one cell, no two in one cell', async () => {
  const ms = await db.machines.toArray();
  expect(ms.every((m) => m.w === 1 && m.h === 1)).toBe(true);
  expect(new Set(ms.map((m) => `${m.x},${m.y}`)).size).toBe(ms.length);
});

test('an existing install with the old layout is compacted once, keeping machine ids and status', async () => {
  // simulate the data of the first version: machines of different sizes on the hall grid
  await db.machines.bulkPut(seedMachines('frezy').map((m) => (m.id === 'm-0' ? { ...m, status: 'out_of_service' as const } : m)));
  await db.meta.delete('layoutVersion');
  await ensureSeeded(db);
  const c60 = (await db.machines.get('m-0'))!;
  const dmu = (await db.machines.get('m-17'))!; // DMU 125, one hall row lower than its neighbours
  expect(c60).toMatchObject({ x: 0, y: 0, w: 1, h: 1, status: 'out_of_service' });
  expect(dmu).toMatchObject({ x: 0, y: 1, w: 1, h: 1 });
  expect(await db.meta.get('layoutVersion')).toMatchObject({ value: 3 });
  // a later manual move in the editor is not undone on the next start
  await db.machines.update('m-17', { x: 20 });
  await ensureSeeded(db);
  expect((await db.machines.get('m-17'))!.x).toBe(20);
});

test('draft survives reopening the database', async () => {
  await startDraft(db, 's-B', 'Novák', NOW);
  await setMachineType(db, 's-B', 'm-0', 'EXT');
  await togglePerson(db, 's-B', 'm-0', 'p1');
  db.close();
  db = openDB(dbName);
  const d = await getDraft(db, 's-B');
  expect(d?.foremanName).toBe('Novák');
  expect(d?.startedAt).toBe(NOW.toISOString());
  expect(d?.assignments['m-0']).toEqual({ type: 'EXT', personIds: ['p1'] });
  expect(await getLastForeman(db, 's-B')).toBe('Novák');
});

test('continueDraft keeps assignments and updates foreman', async () => {
  await startDraft(db, 's-A', 'Starý', NOW);
  await setMachineType(db, 's-A', 'm-0', 'EXT');
  await continueDraft(db, 's-A', 'Nový');
  const d = await getDraft(db, 's-A');
  expect(d?.foremanName).toBe('Nový');
  expect(d?.assignments['m-0'].type).toBe('EXT');
  expect(await getLastForeman(db, 's-A')).toBe('Nový');
});

test('togglePerson twice removes the person', async () => {
  await startDraft(db, 's-A', 'X', NOW);
  await togglePerson(db, 's-A', 'm-0', 'p1');
  await togglePerson(db, 's-A', 'm-0', 'p1');
  expect((await getDraft(db, 's-A'))?.assignments['m-0'].personIds).toEqual([]);
});

test('drafts of different shifts are independent', async () => {
  await startDraft(db, 's-A', 'X', NOW);
  await startDraft(db, 's-B', 'Y', NOW);
  await setMachineType(db, 's-A', 'm-0', 'INT');
  expect((await getDraft(db, 's-B'))?.assignments['m-0']).toBeUndefined();
});

test('deleting or adding a machine leaves the rows packed as soon as it finishes', async () => {
  await deleteMachine(db, 'm-1'); // HERMLE C42 / 4 – second in the first row
  expect(isPacked(await db.machines.toArray())).toBe(true);
  const id = await addMachine(db, { hallId: 'frezy', name: 'Nový', x: 0, y: 99, w: 1, h: 1, status: 'active' });
  const all = await db.machines.toArray();
  expect(isPacked(all)).toBe(true);
  expect(all.find((m) => m.id === id)).toMatchObject({ x: 0, y: 4 }); // new last row
});

test('deleteMachine removes it from all drafts but keeps records', async () => {
  await startDraft(db, 's-A', 'X', NOW);
  await startDraft(db, 's-B', 'Y', NOW);
  await setMachineType(db, 's-A', 'm-0', 'EXT');
  await setMachineType(db, 's-B', 'm-0', 'INT');
  await saveRecordAndReset(db, record({ shiftId: 's-C' }));
  await deleteMachine(db, 'm-0');
  expect(await db.machines.get('m-0')).toBeUndefined();
  expect((await getDraft(db, 's-A'))?.assignments['m-0']).toBeUndefined();
  expect((await getDraft(db, 's-B'))?.assignments['m-0']).toBeUndefined();
  expect((await listRecords(db))[0].rows[0].machineName).toBe('HERMLE C60');
});

test('deletePerson and deactivation remove the person from drafts', async () => {
  const p1 = await upsertPerson(db, { name: 'Kováč', shiftId: 's-A', active: true });
  const p2 = await upsertPerson(db, { name: 'Horváth', shiftId: 's-A', active: true });
  await startDraft(db, 's-A', 'X', NOW);
  await togglePerson(db, 's-A', 'm-0', p1);
  await togglePerson(db, 's-A', 'm-1', p2);
  await deletePerson(db, p1);
  await setPersonActive(db, p2, false);
  const d = await getDraft(db, 's-A');
  expect(d?.assignments['m-0'].personIds).toEqual([]);
  expect(d?.assignments['m-1'].personIds).toEqual([]);
  expect((await db.people.get(p2))?.active).toBe(false);
});

test('deleteShift with people is rejected', async () => {
  await upsertPerson(db, { name: 'Kováč', shiftId: 's-A', active: true });
  await expect(deleteShift(db, 's-A')).rejects.toThrow('Zmena má priradených ľudí');
  await deleteShift(db, 's-C');
  expect(await db.shifts.count()).toBe(2);
});

test('deleting the last remaining shift is refused', async () => {
  await deleteShift(db, 's-A');
  await deleteShift(db, 's-B');
  await expect(deleteShift(db, 's-C')).rejects.toThrow('Musí zostať aspoň jedna zmena');
  expect(await db.shifts.count()).toBe(1);
});

test('upsertShift and upsertMachine create and update', async () => {
  const id = await upsertShift(db, { name: 'D', order: 3 });
  await upsertShift(db, { id, name: 'Nočná', order: 3 });
  expect((await db.shifts.get(id))?.name).toBe('Nočná');
  const mid = await upsertMachine(db, { hallId: 'frezy', name: 'Nový', x: 0, y: 20, w: 1, h: 1, status: 'active' });
  expect(await db.machines.count()).toBe(36);
  expect((await db.machines.get(mid))?.name).toBe('Nový');
});

test('saveRecordAndReset stores the record and removes the draft', async () => {
  await startDraft(db, 's-A', 'X', NOW);
  await saveRecordAndReset(db, record());
  expect(await getDraft(db, 's-A')).toBeUndefined();
  expect(await listRecords(db)).toHaveLength(1);
});

test('listRecords filters and sorts newest first', async () => {
  await saveRecordAndReset(db, record({ id: 'r1', date: '2026-11-09', closedAt: '2026-11-09T14:00:00Z' }));
  await saveRecordAndReset(db, record({ id: 'r2', date: '2026-11-10', closedAt: '2026-11-10T14:00:00Z' }));
  await saveRecordAndReset(db, record({ id: 'r3', shiftId: 's-B', date: '2026-11-10', closedAt: '2026-11-10T22:00:00Z' }));
  expect((await listRecords(db)).map((r) => r.id)).toEqual(['r3', 'r2', 'r1']);
  expect((await listRecords(db, { shiftId: 's-A' })).map((r) => r.id)).toEqual(['r2', 'r1']);
  expect((await listRecords(db, { from: '2026-11-10', to: '2026-11-10' })).map((r) => r.id)).toEqual(['r3', 'r2']);
});

test('copyFromLastRecord maps by machine name and skips inactive people', async () => {
  const p1 = await upsertPerson(db, { name: 'Kováč', shiftId: 's-A', active: true });
  await upsertPerson(db, { name: 'Horváth', shiftId: 's-A', active: false });
  await saveRecordAndReset(db, record({
    rows: [
      { machineName: 'HERMLE C60', type: 'EXT', outOfService: false, people: [
        { name: 'Kováč', homeShiftName: 'A', overtime: false },
        { name: 'Horváth', homeShiftName: 'A', overtime: false },
      ] },
      { machineName: 'Neexistuje', type: 'INT', outOfService: false, people: [] },
    ],
  }));
  await startDraft(db, 's-B', 'Y', NOW);
  expect(await copyFromLastRecord(db, 's-B')).toBe(true);
  const d = await getDraft(db, 's-B');
  expect(d?.assignments['m-0']).toEqual({ type: 'EXT', personIds: [p1] });
  expect(Object.keys(d!.assignments)).toEqual(['m-0']);
});

test('copyFromLastRecord returns false without records', async () => {
  await startDraft(db, 's-B', 'Y', NOW);
  expect(await copyFromLastRecord(db, 's-B')).toBe(false);
});
