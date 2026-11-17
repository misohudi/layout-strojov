import { nickOf } from './nick';
import { computeStats } from './stats';
import { isPool, roleOf, type Hall, type Machine, type Person, type RecordRow, type Shift, type ShiftDraft, type ShiftRecord } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const byPosition = (a: Machine, b: Machine) => a.y - b.y || a.x - b.x;

/** Zones in their order, then position in the plan. */
export function byHallAndPosition(halls: Hall[]) {
  const order = new Map(halls.map((h) => [h.id, h.order]));
  return (a: Machine, b: Machine) => (order.get(a.hallId) ?? 0) - (order.get(b.hallId) ?? 0) || byPosition(a, b);
}

export function buildShiftRecord(input: {
  draft: ShiftDraft;
  shift: Shift;
  machines: Machine[];
  people: Person[];
  shifts: Shift[];
  /** Zones of the department; with more than one, rows and the plan remember the zone. */
  halls?: Hall[];
  now: Date;
  id: string;
}): ShiftRecord {
  const { draft, shift, machines, people, shifts, now, id, halls = [] } = input;
  const hallName = new Map(halls.map((h) => [h.id, h.name]));
  const withHall = halls.length > 1;
  const zone = (m: Machine) => (withHall ? { hallName: hallName.get(m.hallId) ?? '' } : {});
  const personById = new Map(people.map((p) => [p.id, p]));
  const shiftName = new Map(shifts.map((s) => [s.id, s.name]));
  const poolIds = new Set(shifts.filter(isPool).map((s) => s.id));
  const sorted = [...machines].sort(byHallAndPosition(halls));
  const active = sorted.filter((m) => m.status === 'active');
  const inactive = sorted.filter((m) => m.status !== 'active');

  const rows: RecordRow[] = [
    ...active.map((m) => {
      const a = draft.assignments[m.id];
      return {
        machineName: m.name,
        ...zone(m),
        type: a?.type ?? null,
        outOfService: false,
        priority: !!a?.priority && !!a.type,
        people: (a?.personIds ?? [])
          .map((pid) => personById.get(pid))
          .filter((p): p is Person => !!p)
          .map((p) => ({
            name: p.name,
            homeShiftName: shiftName.get(p.shiftId) ?? '',
            overtime: p.shiftId !== draft.shiftId && !poolIds.has(p.shiftId),
            role: roleOf(p),
          })),
      };
    }),
    ...inactive.map((m) => ({ machineName: m.name, ...zone(m), type: null, outOfService: true, people: [] })),
  ];

  return {
    id,
    shiftId: draft.shiftId,
    shiftName: shift.name,
    foremanName: draft.foremanName,
    date: localDate(draft.startedAt),
    startedAt: draft.startedAt,
    closedAt: now.toISOString(),
    stats: computeStats(machines, draft.assignments, people),
    rows,
    layout: machines.map((m) => ({
      name: m.name,
      nick: nickOf(m),
      ...(withHall ? { hallId: m.hallId, hallName: hallName.get(m.hallId) ?? '' } : {}),
      x: m.x,
      y: m.y,
      w: m.w,
      h: m.h,
      type: m.status === 'active' ? (draft.assignments[m.id]?.type ?? null) : null,
      outOfService: m.status !== 'active',
      priority: m.status === 'active' && !!draft.assignments[m.id]?.priority && !!draft.assignments[m.id]?.type,
    })),
  };
}
