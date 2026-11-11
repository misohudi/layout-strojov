import { computeStats } from './stats';
import { isPool, type Machine, type Person, type RecordRow, type Shift, type ShiftDraft, type ShiftRecord } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const byPosition = (a: Machine, b: Machine) => a.y - b.y || a.x - b.x;

export function buildShiftRecord(input: {
  draft: ShiftDraft;
  shift: Shift;
  machines: Machine[];
  people: Person[];
  shifts: Shift[];
  now: Date;
  id: string;
}): ShiftRecord {
  const { draft, shift, machines, people, shifts, now, id } = input;
  const personById = new Map(people.map((p) => [p.id, p]));
  const shiftName = new Map(shifts.map((s) => [s.id, s.name]));
  const poolIds = new Set(shifts.filter(isPool).map((s) => s.id));
  const sorted = [...machines].sort(byPosition);
  const active = sorted.filter((m) => m.status === 'active');
  const inactive = sorted.filter((m) => m.status !== 'active');

  const rows: RecordRow[] = [
    ...active.map((m) => {
      const a = draft.assignments[m.id];
      return {
        machineName: m.name,
        type: a?.type ?? null,
        outOfService: false,
        people: (a?.personIds ?? [])
          .map((pid) => personById.get(pid))
          .filter((p): p is Person => !!p)
          .map((p) => ({
            name: p.name,
            homeShiftName: shiftName.get(p.shiftId) ?? '',
            overtime: p.shiftId !== draft.shiftId && !poolIds.has(p.shiftId),
          })),
      };
    }),
    ...inactive.map((m) => ({ machineName: m.name, type: null, outOfService: true, people: [] })),
  ];

  return {
    id,
    shiftId: draft.shiftId,
    shiftName: shift.name,
    foremanName: draft.foremanName,
    date: localDate(draft.startedAt),
    startedAt: draft.startedAt,
    closedAt: now.toISOString(),
    stats: computeStats(machines, draft.assignments),
    rows,
    layout: machines.map((m) => ({
      name: m.name,
      x: m.x,
      y: m.y,
      w: m.w,
      h: m.h,
      type: m.status === 'active' ? (draft.assignments[m.id]?.type ?? null) : null,
      outOfService: m.status !== 'active',
    })),
  };
}
