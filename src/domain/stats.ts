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
  const assigned = new Set<string>();
  let total = 0, staffed = 0, ext = 0, int = 0, peopleWithoutType = 0;
  for (const m of machines) {
    if (m.status !== 'active') continue;
    total++;
    const a = assignments[m.id];
    if (!a) continue;
    if (a.personIds.length > 0) staffed++;
    for (const pid of a.personIds) assigned.add(pid);
    if (a.type === 'EXT') ext++;
    else if (a.type === 'INT') int++;
    else if (a.personIds.length > 0) peopleWithoutType++;
  }
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
    occupied, ext, int,
    occupancyPct: pct(occupied, total),
    extPct: pct(ext, occupied),
    intPct: pct(int, occupied),
    peopleWithoutType,
  };
}
