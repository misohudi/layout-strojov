import { openDB, ensureSeeded, type AppDB } from './db';
import {
  getDraft, startDraft, getLastForeman, setMachineType, togglePerson, copyFromLastRecord,
  upsertPerson, deletePerson, setPersonActive, upsertMachine, deleteMachine,
  upsertShift, deleteShift, saveRecordAndReset, listRecords,
} from './repo';
import type { ShiftRecord } from '../domain/types';

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
