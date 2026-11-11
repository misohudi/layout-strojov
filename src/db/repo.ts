import type { AppDB } from './db';
import { getMeta, setMeta } from './db';
import type { Assignment, Machine, OrderType, Person, Shift, ShiftDraft, ShiftRecord } from '../domain/types';

const newId = () => crypto.randomUUID();

export function getDraft(db: AppDB, shiftId: string): Promise<ShiftDraft | undefined> {
  return db.drafts.get(shiftId);
}

/** Starts a fresh (empty) draft for the shift, replacing any existing one. */
export async function startDraft(db: AppDB, shiftId: string, foremanName: string, now: Date): Promise<ShiftDraft> {
  const draft: ShiftDraft = { shiftId, foremanName, startedAt: now.toISOString(), assignments: {} };
  await db.transaction('rw', db.drafts, db.meta, async () => {
    await db.drafts.put(draft);
    await setMeta(db, `lastForeman:${shiftId}`, foremanName);
  });
  return draft;
}

export function getLastForeman(db: AppDB, shiftId: string): Promise<string | undefined> {
  return getMeta<string>(db, `lastForeman:${shiftId}`);
}

async function updateAssignment(
  db: AppDB, shiftId: string, machineId: string, fn: (a: Assignment) => Assignment,
): Promise<void> {
  await db.transaction('rw', db.drafts, async () => {
    const d = await db.drafts.get(shiftId);
    if (!d) throw new Error('Zmena nie je otvorená');
    const cur = d.assignments[machineId] ?? { type: null, personIds: [] };
    d.assignments = { ...d.assignments, [machineId]: fn(cur) };
    await db.drafts.put(d);
  });
}

export function setMachineType(db: AppDB, shiftId: string, machineId: string, type: OrderType | null) {
  return updateAssignment(db, shiftId, machineId, (a) => ({ ...a, type }));
}

export function togglePerson(db: AppDB, shiftId: string, machineId: string, personId: string) {
  return updateAssignment(db, shiftId, machineId, (a) => ({
    ...a,
    personIds: a.personIds.includes(personId)
      ? a.personIds.filter((p) => p !== personId)
      : [...a.personIds, personId],
  }));
}

/** Copies types and people from the most recent record (any shift) into the shift's draft. */
export async function copyFromLastRecord(db: AppDB, shiftId: string): Promise<boolean> {
  return db.transaction('rw', [db.records, db.machines, db.people, db.shifts, db.drafts], async () => {
    const last = await db.records.orderBy('closedAt').last();
    const draft = await db.drafts.get(shiftId);
    if (!last || !draft) return false;
    const machines = await db.machines.toArray();
    const people = (await db.people.toArray()).filter((p) => p.active);
    const shifts = await db.shifts.toArray();
    const shiftName = new Map(shifts.map((s) => [s.id, s.name]));
    const assignments: Record<string, Assignment> = {};
    for (const row of last.rows) {
      if (row.outOfService) continue;
      const m = machines.find((x) => x.name === row.machineName && x.status === 'active');
      if (!m) continue;
      const personIds: string[] = [];
      for (const rp of row.people) {
        const matches = people.filter((p) => p.name === rp.name);
        const p = matches.find((x) => shiftName.get(x.shiftId) === rp.homeShiftName) ?? matches[0];
        if (p && !personIds.includes(p.id)) personIds.push(p.id);
      }
      assignments[m.id] = { type: row.type, personIds };
    }
    await db.drafts.put({ ...draft, assignments });
    return true;
  });
}

async function removeFromDrafts(db: AppDB, fn: (a: Record<string, Assignment>) => Record<string, Assignment>) {
  const drafts = await db.drafts.toArray();
  await db.drafts.bulkPut(drafts.map((d) => ({ ...d, assignments: fn(d.assignments) })));
}

const withoutPerson = (personId: string) => (as: Record<string, Assignment>) =>
  Object.fromEntries(
    Object.entries(as).map(([k, a]) => [k, { ...a, personIds: a.personIds.filter((p) => p !== personId) }]),
  );

export async function upsertPerson(db: AppDB, p: Omit<Person, 'id'> & { id?: string }): Promise<string> {
  const id = p.id ?? newId();
  await db.people.put({ ...p, id });
  return id;
}

export async function deletePerson(db: AppDB, id: string): Promise<void> {
  await db.transaction('rw', db.people, db.drafts, async () => {
    await db.people.delete(id);
    await removeFromDrafts(db, withoutPerson(id));
  });
}

export async function setPersonActive(db: AppDB, id: string, active: boolean): Promise<void> {
  await db.transaction('rw', db.people, db.drafts, async () => {
    await db.people.update(id, { active });
    if (!active) await removeFromDrafts(db, withoutPerson(id));
  });
}

export async function upsertMachine(db: AppDB, m: Omit<Machine, 'id'> & { id?: string }): Promise<string> {
  const id = m.id ?? newId();
  await db.machines.put({ ...m, id });
  return id;
}

export async function deleteMachine(db: AppDB, id: string): Promise<void> {
  await db.transaction('rw', db.machines, db.drafts, async () => {
    await db.machines.delete(id);
    await removeFromDrafts(db, (as) => {
      const { [id]: _removed, ...rest } = as;
      return rest;
    });
  });
}

export async function upsertShift(db: AppDB, s: Omit<Shift, 'id'> & { id?: string }): Promise<string> {
  const id = s.id ?? newId();
  await db.shifts.put({ ...s, id });
  return id;
}

export async function deleteShift(db: AppDB, id: string): Promise<void> {
  await db.transaction('rw', db.shifts, db.people, db.drafts, async () => {
    if ((await db.people.where('shiftId').equals(id).count()) > 0) {
      throw new Error('Zmena má priradených ľudí');
    }
    await db.shifts.delete(id);
    await db.drafts.delete(id);
  });
}

export async function saveRecordAndReset(db: AppDB, record: ShiftRecord): Promise<void> {
  await db.transaction('rw', db.records, db.drafts, async () => {
    await db.records.put(record);
    await db.drafts.delete(record.shiftId);
  });
}

export async function listRecords(
  db: AppDB, filter: { shiftId?: string; from?: string; to?: string } = {},
): Promise<ShiftRecord[]> {
  const all = await db.records.orderBy('closedAt').reverse().toArray();
  return all.filter(
    (r) =>
      (!filter.shiftId || r.shiftId === filter.shiftId) &&
      (!filter.from || r.date >= filter.from) &&
      (!filter.to || r.date <= filter.to),
  );
}
