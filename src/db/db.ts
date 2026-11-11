import Dexie, { type EntityTable } from 'dexie';
import type { Machine, Person, Shift, ShiftDraft, ShiftRecord } from '../domain/types';
import { HALL_FREZY, seedMachines, seedShifts } from '../domain/seed';

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  machines!: EntityTable<Machine, 'id'>;
  shifts!: EntityTable<Shift, 'id'>;
  people!: EntityTable<Person, 'id'>;
  drafts!: EntityTable<ShiftDraft, 'shiftId'>;
  records!: EntityTable<ShiftRecord, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      machines: 'id, hallId',
      shifts: 'id, order',
      people: 'id, shiftId',
      drafts: 'shiftId',
      records: 'id, shiftId, date, closedAt',
      meta: 'key',
    });
  }
}

export const TABLES = ['machines', 'shifts', 'people', 'drafts', 'records', 'meta'] as const;

export function openDB(name = 'layout-strojov'): AppDB {
  return new AppDB(name);
}

export async function ensureSeeded(db: AppDB): Promise<void> {
  await db.transaction('rw', db.machines, db.shifts, db.meta, async () => {
    if (await db.meta.get('seeded')) return;
    await db.machines.bulkPut(seedMachines(HALL_FREZY));
    await db.shifts.bulkPut(seedShifts());
    await db.meta.put({ key: 'seeded', value: true });
  });
}

export async function getMeta<T>(db: AppDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(db: AppDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
