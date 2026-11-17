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

/**
 * Layout versions: 1 = machines of different sizes on the hall grid; 2 = equal cells with aisles
 * (briefly deployed); 3 = equal cells, rows of the hall packed side by side without aisles.
 */
export const LAYOUT_VERSION = 3;

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

/** Original hall positions, when the machines are still exactly the seeded ones (ids and names). */
function originalPositions(machines: Machine[]): Machine[] | null {
  const seed = new Map(seedMachines(HALL_FREZY).map((m) => [m.id, m]));
  if (machines.length !== seed.size) return null;
  if (!machines.every((m) => seed.get(m.id)?.name === m.name && m.hallId === HALL_FREZY)) return null;
  return machines.map((m) => {
    const s = seed.get(m.id)!;
    return { ...m, x: s.x, y: s.y, w: s.w, h: s.h };
  });
}

/**
 * One-time switch to equally sized cells in packed rows, keeping the order of the hall.
 * Runs again after restoring a backup made with an older layout.
 * Call inside a transaction that includes `machines` and `meta`.
 */
export async function ensureCompactLayout(db: AppDB): Promise<void> {
  const version = (await db.meta.get('layoutVersion'))?.value;
  if (typeof version === 'number' && version >= LAYOUT_VERSION) return;
  let machines = await db.machines.toArray();
  // Version 2 already lost the original rows (a stacked machine looks like its own row):
  // start again from the hall positions when the machines were not changed since.
  if (version === 2) machines = originalPositions(machines) ?? machines;
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
