import Dexie, { type EntityTable } from 'dexie';
import type { Hall, Machine, Person, Shift, ShiftDraft, ShiftRecord } from '../domain/types';
import { HALL_FREZY, seedHalls, seedHscMachines, seedMachines, seedShifts } from '../domain/seed';
import { hallLayout } from '../domain/compact';

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  machines!: EntityTable<Machine, 'id'>;
  halls!: EntityTable<Hall, 'id'>;
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
    // zones of the department (milling hall, HSC…), each with its own plan
    this.version(2).stores({ halls: 'id, order' });
  }
}

export const TABLES = ['machines', 'halls', 'shifts', 'people', 'drafts', 'records', 'meta'] as const;

export function openDB(name = 'layout-strojov'): AppDB {
  return new AppDB(name);
}

/**
 * Layout versions: 1 = machines of different sizes on the hall grid; 2 = equal cells keeping the hall's
 * columns, gaps and aisles; 3 = equal cells packed side by side (no aisles, later reverted);
 * 4 = the same plan as version 2.
 */
export const LAYOUT_VERSION = 4;

export async function ensureSeeded(db: AppDB): Promise<void> {
  await db.transaction('rw', db.machines, db.halls, db.shifts, db.meta, async () => {
    if (!(await db.meta.get('seeded'))) {
      await db.machines.bulkPut(seedMachines(HALL_FREZY));
      await db.shifts.bulkPut(seedShifts());
      await db.meta.put({ key: 'seeded', value: true });
    }
    await ensureCompactLayout(db);
    await ensureHalls(db); // after the layout step, which would pack the HSC machines to the left
  });
}

/**
 * Zones: installations from before zones get the milling hall and the new HSC zone with its two
 * Mikron machines. Runs once (when there are no zones yet). Call inside a transaction with `halls`
 * and `machines`.
 */
export async function ensureHalls(db: AppDB): Promise<void> {
  if ((await db.halls.count()) > 0) return;
  await db.halls.bulkPut(seedHalls());
  const hsc = seedHscMachines();
  if ((await db.machines.where('hallId').equals(hsc[0].hallId).count()) === 0) await db.machines.bulkPut(hsc);
}

/**
 * Original hall positions, when the milling hall's machines are still exactly the seeded ones (ids and
 * names). Other zones are left out.
 */
function originalPositions(all: Machine[]): Machine[] | null {
  const seed = new Map(seedMachines(HALL_FREZY).map((m) => [m.id, m]));
  const machines = all.filter((m) => m.hallId === HALL_FREZY);
  if (machines.length !== seed.size) return null;
  if (!machines.every((m) => seed.get(m.id)?.name === m.name)) return null;
  return machines.map((m) => {
    const s = seed.get(m.id)!;
    return { ...m, x: s.x, y: s.y, w: s.w, h: s.h };
  });
}

/**
 * One-time switch to equally sized cells that keep the hall's columns, gaps and aisles.
 * Runs again after restoring a backup made with an older layout.
 * Call inside a transaction that includes `machines` and `meta`.
 */
export async function ensureCompactLayout(db: AppDB): Promise<void> {
  const version = (await db.meta.get('layoutVersion'))?.value;
  if (typeof version === 'number' && version >= LAYOUT_VERSION) return;
  // version 2 is already this plan
  if (version !== 2) {
    let machines = await db.machines.toArray();
    // version 3 packed the rows and lost the hall's columns: start again from the hall positions when
    // the machines were not changed since; otherwise keep them where they are (already one cell each)
    const fromHall = version === 3 ? originalPositions(machines) : machines;
    if (fromHall) {
      machines = fromHall;
      for (const hall of new Set(machines.map((m) => m.hallId))) {
        await db.machines.bulkPut(hallLayout(machines.filter((m) => m.hallId === hall)));
      }
    }
  }
  await db.meta.put({ key: 'layoutVersion', value: LAYOUT_VERSION });
}

export async function getMeta<T>(db: AppDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(db: AppDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
