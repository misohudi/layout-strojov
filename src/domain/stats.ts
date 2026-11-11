import type { Assignment, Machine, Stats } from './types';

/** Percentage with one decimal (e.g. 2.9), so small changes such as one machine out of service show up. */
const pct = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 10;

export function computeStats(machines: Machine[], assignments: Record<string, Assignment>): Stats {
  let total = 0, ext = 0, int = 0, peopleWithoutType = 0;
  for (const m of machines) {
    if (m.status !== 'active') continue;
    total++;
    const a = assignments[m.id];
    if (!a) continue;
    if (a.type === 'EXT') ext++;
    else if (a.type === 'INT') int++;
    else if (a.personIds.length > 0) peopleWithoutType++;
  }
  const occupied = ext + int;
  return {
    total, occupied, ext, int,
    occupancyPct: pct(occupied, total),
    extPct: pct(ext, occupied),
    intPct: pct(int, occupied),
    peopleWithoutType,
  };
}
