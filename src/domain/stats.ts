import { roleOf, type Assignment, type Machine, type Person, type Stats } from './types';

/** Percentage with one decimal (e.g. 2.9), so small changes such as one machine out of service show up. */
const pct = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 10;

/**
 * Main figure: occupancy by people (active machines with at least one person / active machines).
 * Order occupancy (EXT/INT) is kept as a secondary figure. People are counted once per role,
 * even when one person works on several machines.
 */
export function computeStats(
  machines: Machine[], assignments: Record<string, Assignment>, people: Person[] = [],
): Stats {
  const personById = new Map(people.map((p) => [p.id, p]));
  /** On how many active machines each person works. */
  const machinesOf = new Map<string, string[]>();
  let total = 0, staffed = 0, ext = 0, int = 0, peopleWithoutType = 0, oos = 0, prio = 0;
  for (const m of machines) {
    if (m.status !== 'active') {
      oos++;
      continue;
    }
    total++;
    const a = assignments[m.id];
    if (!a) continue;
    if (a.personIds.length > 0) staffed++;
    for (const pid of a.personIds) machinesOf.set(pid, [...(machinesOf.get(pid) ?? []), m.id]);
    if (a.type === 'EXT') ext++;
    else if (a.type === 'INT') int++;
    else if (a.personIds.length > 0) peopleWithoutType++;
    if (a.type && a.priority) prio++;
  }
  const assigned = new Set(machinesOf.keys());
  // viacobsluha: one person on several machines
  const multi = [...machinesOf.values()].filter((ms) => ms.length > 1);
  const multiPeople = multi.length;
  const multiMachines = new Set(multi.flat()).size;
  let frezari = 0, operatori = 0;
  for (const pid of assigned) {
    const p = personById.get(pid);
    if (!p) continue;
    if (roleOf(p) === 'operator') operatori++;
    else frezari++;
  }
  const occupied = ext + int;
  return {
    total,
    staffed,
    staffedPct: pct(staffed, total),
    frezari,
    operatori,
    multiPeople,
    multiMachines,
    free: total - ext - int,
    oos,
    prio,
    occupied, ext, int,
    occupancyPct: pct(occupied, total),
    extPct: pct(ext, occupied),
    intPct: pct(int, occupied),
    peopleWithoutType,
  };
}
