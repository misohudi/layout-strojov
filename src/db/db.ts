import Dexie, { type EntityTable } from 'dexie';
import type { Machine, Person, Shift, ShiftDraft, ShiftRecord } from '../domain/types';
import { HALL_FREZY, seedMachines, seedShifts } from '../domain/seed';
import { compactLayout } from '../domain/compact';

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

/** 2 = every machine takes one equally sized cell of a compacted plan. */
export const LAYOUT_VERSION = 2;

export async function ensureSeeded(db: AppDB): Promise<void> {
  await db.transaction('rw', db.machines, db.shifts, db.meta, async () => {
    if (!(await db.meta.get('seeded'))) {
      await db.machines.bulkPut(seedMachines(HALL_FREZY));
      await db.shifts.bulkPut(seedShifts());
      await db.meta.put({ key: 'seeded', value: true });
    }
    await ensureCompactLayout(db);
  });
}

/**
 * One-time switch from machines of different sizes to equally sized cells, keeping their positions
 * relative to each other. Runs again after restoring a backup made before the switch.
 * Call inside a transaction that includes `machines` and `meta`.
 */
export async function ensureCompactLayout(db: AppDB): Promise<void> {
  const version = (await db.meta.get('layoutVersion'))?.value;
  if (typeof version === 'number' && version >= LAYOUT_VERSION) return;
  const machines = await db.machines.toArray();
  for (const hall of new Set(machines.map((m) => m.hallId))) {
    await db.machines.bulkPut(compactLayout(machines.filter((m) => m.hallId === hall)));
  }
  await db.meta.put({ key: 'layoutVersion', value: LAYOUT_VERSION });
}

export async function getMeta<T>(db: AppDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(db: AppDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
