import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from './useDB';
import { listRecords } from '../db/repo';
import { computeStats, multiText } from '../domain/stats';
import { byHallAndPosition } from '../domain/record';
import { formatPct, skDate } from '../report/xlsx';
import { tileClass } from './MachineTile';
import { justDropped } from './dragPerson';
import { roleOf, ROLE_LABEL, type Assignment, type Hall, type Machine, type Person, type ShiftRecord, type Stats } from '../domain/types';

function Sheet({ title, onClose, children, seeThrough = false }: { title: string; onClose(): void; children: React.ReactNode; seeThrough?: boolean }) {
  return (
    <div className={`sheet-backdrop sheet-backdrop--light ${seeThrough ? 'sheet-backdrop--drag' : ''}`} onClick={() => !justDropped() && onClose()}>
      <div className={`sheet ${seeThrough ? 'sheet--see-through' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__top">
          <div className="sheet__head">
            <h2>{title}</h2>
            <button className="btn" onClick={onClose}>Zavrieť</button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Farther apart than this many cells (in one zone), a person's machines get a warning. */
export const FAR_CELLS = 3;

export interface MultiGroup {
  person: Person;
  /** Number shown on the person's machines on the plan (1, 2, …). */
  no: number;
  machines: Machine[];
  /** Why the machines are impractical together, if they are. */
  warning: string | null;
}

/** People working on several active machines (viacobsluha), numbered by name, with their machines. */
export function multiGroups(machines: Machine[], halls: Hall[], assignments: Record<string, Assignment>, people: Person[]): MultiGroup[] {
  const active = machines.filter((m) => m.status === 'active').sort(byHallAndPosition(halls));
  const byPerson = new Map<string, Machine[]>();
  for (const m of active) for (const pid of assignments[m.id]?.personIds ?? []) byPerson.set(pid, [...(byPerson.get(pid) ?? []), m]);
  return people
    .filter((p) => (byPerson.get(p.id)?.length ?? 0) > 1)
    .sort((a, b) => a.name.localeCompare(b.name, 'sk'))
    .map((person, i) => {
      const ms = byPerson.get(person.id)!;
      let warning: string | null = null;
      if (new Set(ms.map((m) => m.hallId)).size > 1) warning = 'Stroje sú v rôznych oddeleniach.';
      else {
        let far = 0;
        for (const a of ms) for (const b of ms) far = Math.max(far, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        if (far > FAR_CELLS) warning = `Stroje sú ďaleko od seba (${far} polí).`;
      }
      return { person, no: i + 1, machines: ms, warning };
    });
}

/**
 * Tap on "Viacobsluha": who works on which machines. The plan highlights those machines with the
 * person's number; this sheet has one row per person with their machines (tap = open the machine) and
 * a warning when the machines are in different zones or far apart.
 */
export function MultiSheet({ groups, assignments, halls, onPick, onClose }: {
  groups: MultiGroup[];
  assignments: Record<string, Assignment>;
  halls: Hall[];
  onPick(machineId: string): void;
  onClose(): void;
}) {
  const hallName = new Map(halls.map((h) => [h.id, h.name]));
  return (
    <Sheet title="Viacobsluha – kto na čom robí" onClose={onClose}>
      {groups.length === 0 ? (
        <p className="muted">Nikto teraz nerobí na viacerých strojoch.</p>
      ) : (
        <ul className="insight__multi">
          {groups.map((g) => (
            <li key={g.person.id} aria-label={g.person.name}>
              <div className="insight__multi-who">
                <span className="tile__mark" aria-hidden="true">{g.no}</span>
                <strong>{g.person.name}</strong>
                <span className={`role-badge ${roleOf(g.person) === 'operator' ? 'role-badge--operator' : ''}`}>{ROLE_LABEL[roleOf(g.person)]}</span>
                <span className="muted">{`${g.machines.length} stroje`}</span>
              </div>
              <div className="insight__chips">
                {g.machines.map((m) => {
                  const a = assignments[m.id];
                  return (
                    <button key={m.id} type="button" className="insight__machine" onClick={() => onPick(m.id)}>
                      <span className={`type-badge ${tileClass(a?.type ?? null, false)}`}>{a?.type ?? 'voľný'}</span>
                      <span>{m.name}</span>
                      {halls.length > 1 && <span className="muted">{hallName.get(m.hallId)}</span>}
                    </button>
                  );
                })}
              </div>
              {g.warning && <p className="insight__warn" role="note">{`⚠ ${g.warning}`}</p>}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/** One line of a breakdown: a zone, or the total (last). */
export interface BreakdownRow {
  name: string;
  s: Stats;
  total?: boolean;
}

/**
 * The breakdown of a closed shift, rebuilt from its rows: per zone (when it had several) and the total
 * as stored with the shift.
 */
export function recordBreakdown(record: ShiftRecord, halls: Hall[]): BreakdownRow[] {
  const names = [...new Set(record.rows.map((r) => r.hallName ?? ''))];
  const total = { name: 'Spolu', s: record.stats, total: true };
  if (names.length <= 1 || names.some((n) => !n)) return [total];
  const order = (n: string) => {
    const i = halls.findIndex((h) => h.name === n);
    return i < 0 ? halls.length : i;
  };
  names.sort((a, b) => order(a) - order(b));
  // the shift's people and machines as they were, so the usual counting applies
  const key = (p: { name: string; homeShiftName: string }) => `${p.homeShiftName}|${p.name}`;
  const people = new Map<string, Person>();
  const machines: Machine[] = [];
  const assignments: Record<string, Assignment> = {};
  record.rows.forEach((r, i) => {
    const id = `r${i}`;
    machines.push({ id, hallId: r.hallName ?? '', name: r.machineName, x: 0, y: 0, w: 1, h: 1, status: r.outOfService ? 'out_of_service' : 'active' });
    assignments[id] = { type: r.type, personIds: r.people.map(key), priority: r.priority };
    for (const p of r.people) people.set(key(p), { id: key(p), name: p.name, shiftId: '', active: true, role: p.role });
  });
  return [
    ...names.map((n) => ({ name: n, s: computeStats(machines.filter((m) => m.hallId === n), assignments, [...people.values()]) })),
    total,
  ];
}

const shortDate = (date: string) => skDate(date).replace(/\d{4}$/, '');

/** Last closed shifts in the trend chart. */
export const TREND_SHIFTS = 14;

/** A figure of the closed shifts (oldest first) plus the open one ("teraz"), as bars. */
interface TrendPoint {
  label: string;
  sub: string;
  pct: number | null;
  now?: boolean;
  /** The breakdown of that shift (per zone and in total), shown above the chart when its bar is tapped. */
  rows(): BreakdownRow[];
}

function TrendChart({ points, label, picked, onPick }: { points: TrendPoint[]; label: string; picked: number; onPick(i: number): void }) {
  const W = 640, H = 200, top = 22, bottom = 34, left = 34, right = 8;
  const plotH = H - top - bottom;
  const slot = (W - left - right) / Math.max(points.length, 1);
  const barW = Math.max(6, Math.min(36, slot - 2)); // 2 px gap between bars at least
  // the scale follows the data (in steps of 25 %), so low utilisation is still readable
  const max = Math.max(0, ...points.map((p) => p.pct ?? 0));
  const yMax = Math.min(100, Math.max(25, Math.ceil((max * 1.15) / 25) * 25));
  const y = (v: number) => top + plotH - (v / yMax) * plotH;
  const known = points.filter((p) => !p.now && p.pct != null).map((p) => p.pct as number);
  const avg = known.length ? known.reduce((s, v) => s + v, 0) / known.length : null;
  const sel = points[picked];
  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} className="trend__svg" role="img" aria-label={label}>
        {[0, yMax / 2, yMax].map((v) => (
          <g key={v}>
            <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className="trend__grid" />
            <text x={left - 6} y={y(v) + 4} className="trend__axis" textAnchor="end">{`${v} %`}</text>
          </g>
        ))}
        {avg != null && (
          <g>
            <line x1={left} x2={W - right} y1={y(avg)} y2={y(avg)} className="trend__avg" />
            <text x={W - right} y={y(avg) - 5} className="trend__axis" textAnchor="end">{`priemer ${formatPct(Math.round(avg * 10) / 10)}`}</text>
          </g>
        )}
        {points.map((p, i) => {
          const x = left + i * slot + (slot - barW) / 2;
          const v = p.pct ?? 0;
          const h = Math.max(0, y(0) - y(v));
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={i} className={`trend__bar ${p.now ? 'trend__bar--now' : ''} ${i === picked ? 'trend__bar--on' : ''}`} onClick={() => onPick(i)}>
              {/* hit area bigger than the bar */}
              <rect x={left + i * slot} y={top} width={slot} height={plotH + bottom} className="trend__hit" />
              {h > 0 && (
                <path d={`M${x} ${y(0)}V${y(v) + r}Q${x} ${y(v)} ${x + r} ${y(v)}H${x + barW - r}Q${x + barW} ${y(v)} ${x + barW} ${y(v) + r}V${y(0)}Z`} />
              )}
              <text x={x + barW / 2} y={H - bottom + 14} className="trend__axis" textAnchor="middle">{p.label}</text>
              <text x={x + barW / 2} y={H - bottom + 27} className="trend__axis" textAnchor="middle">{p.sub}</text>
            </g>
          );
        })}
      </svg>
      {sel && (
        <figcaption className="trend__readout" aria-live="polite">
          <strong>{formatPct(sel.pct)}</strong>
          {` · ${sel.now ? 'táto zmena (teraz)' : `${sel.label} · zmena ${sel.sub}`}`}
          <span className="muted"> – ťuknutím na stĺpec zobrazíte rozpis tej zmeny</span>
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Tap on "Vyťaženie strojov": the breakdown now (EXT / INT / free / out of service, per zone) and how
 * the utilisation went in the last closed shifts, so today can be compared with the usual.
 */
export function UtilizationSheet({ machines, halls, assignments, stats, onClose }: {
  machines: Machine[];
  halls: Hall[];
  assignments: Record<string, Assignment>;
  stats: Stats;
  onClose(): void;
}) {
  const db = useDB();
  const records = useLiveQuery(() => listRecords(db), [db]) ?? [];
  const recent = records.slice(0, TREND_SHIFTS).reverse();
  const nowRows: BreakdownRow[] = [
    ...(halls.length > 1
      ? halls.map((h) => ({ name: h.name, s: computeStats(machines.filter((m) => m.hallId === h.id), assignments) }))
      : []),
    { name: 'Spolu', s: stats, total: true },
  ];
  const points: TrendPoint[] = [
    ...recent.map((r) => ({ label: shortDate(r.date), sub: r.shiftName, pct: r.stats.occupancyPct, rows: () => recordBreakdown(r, halls) })),
    { label: 'teraz', sub: '', pct: stats.occupancyPct, now: true, rows: () => nowRows },
  ];
  // a tapped bar shows that shift's figures; this shift (teraz) until then
  const [picked, setPicked] = useState<number | null>(null);
  const idx = picked ?? points.length - 1;
  const sel = points[idx];
  const rows = sel.rows();
  const total = rows[rows.length - 1].s;
  const title = sel.now ? 'Rozpis teraz' : `Rozpis – ${sel.label} · zmena ${sel.sub}`;
  return (
    <Sheet title="Vyťaženie strojov" onClose={onClose}>
      <p className="insight__lead">
        <strong>{formatPct(total.occupancyPct)}</strong>
        {` · ${total.occupied} / ${total.total} strojov v prevádzke má zákazku`}
      </p>
      <section aria-label={title}>
        <h3>{title}</h3>
        <div className="table-wrap">
          <table className="insight__table">
            <thead>
              <tr><th>{rows.length > 1 ? 'Oddelenie' : ''}</th><th>EXT</th><th>INT</th><th>Voľné</th><th>Mimo prev.</th><th>Vyťaženie</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={r.total ? 'insight__total' : ''}>
                  <td>{r.name}</td>
                  <td>{r.s.ext}</td>
                  <td>{r.s.int}</td>
                  <td>{r.s.free ?? r.s.total - r.s.occupied}</td>
                  <td>{r.s.oos ?? 0}</td>
                  <td><strong>{formatPct(r.s.occupancyPct)}</strong>{` (${r.s.occupied}/${r.s.total})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-label="Vývoj">
        <h3>{`Vývoj – posledné zmeny`}</h3>
        {recent.length === 0 ? (
          <p className="muted">Zatiaľ žiadne uzavreté zmeny na porovnanie.</p>
        ) : (
          <TrendChart points={points} label="Vyťaženie strojov v posledných zmenách" picked={idx} onPick={setPicked} />
        )}
      </section>
    </Sheet>
  );
}

/**
 * Tap on "Obsadenosť": machines with people now (per zone: with / without people, milling operators,
 * operators, viacobsluha) and how the staffing went in the last closed shifts.
 */
export function StaffingStatsSheet({ machines, halls, assignments, people, stats, onClose }: {
  machines: Machine[];
  halls: Hall[];
  assignments: Record<string, Assignment>;
  people: Person[];
  stats: Stats;
  onClose(): void;
}) {
  const db = useDB();
  const records = useLiveQuery(() => listRecords(db), [db]) ?? [];
  // older records have no staffing figures – they are left out of the trend
  const recent = records.filter((r) => r.stats.staffedPct != null).slice(0, TREND_SHIFTS).reverse();
  const nowRows: BreakdownRow[] = [
    ...(halls.length > 1
      ? halls.map((h) => ({ name: h.name, s: computeStats(machines.filter((m) => m.hallId === h.id), assignments, people) }))
      : []),
    { name: 'Spolu', s: stats, total: true },
  ];
  const points: TrendPoint[] = [
    ...recent.map((r) => ({ label: shortDate(r.date), sub: r.shiftName, pct: r.stats.staffedPct ?? null, rows: () => recordBreakdown(r, halls) })),
    { label: 'teraz', sub: '', pct: stats.staffedPct ?? null, now: true, rows: () => nowRows },
  ];
  // a tapped bar shows that shift's figures; this shift (teraz) until then
  const [picked, setPicked] = useState<number | null>(null);
  const idx = picked ?? points.length - 1;
  const sel = points[idx];
  const rows = sel.rows();
  const total = rows[rows.length - 1].s;
  const title = sel.now ? 'Rozpis teraz' : `Rozpis – ${sel.label} · zmena ${sel.sub}`;
  return (
    <Sheet title="Obsadenosť ľuďmi" onClose={onClose}>
      <p className="insight__lead">
        <strong>{formatPct(total.staffedPct ?? null)}</strong>
        {` · ${total.staffed ?? 0} / ${total.total} strojov v prevádzke má ľudí`}
      </p>
      <section aria-label={title}>
        <h3>{title}</h3>
        <div className="table-wrap">
          <table className="insight__table">
            <thead>
              <tr><th>{rows.length > 1 ? 'Oddelenie' : ''}</th><th>S ľuďmi</th><th>Bez ľudí</th><th>Frézari</th><th>Operátori</th><th>Viacobsluha</th><th>Obsadenosť</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={r.total ? 'insight__total' : ''}>
                  <td>{r.name}</td>
                  <td>{r.s.staffed ?? 0}</td>
                  <td>{r.s.total - (r.s.staffed ?? 0)}</td>
                  <td>{r.s.frezari ?? 0}</td>
                  <td>{r.s.operatori ?? 0}</td>
                  <td>{multiText(r.s.multiPeople ?? 0, r.s.multiMachines)}</td>
                  <td><strong>{formatPct(r.s.staffedPct ?? null)}</strong>{` (${r.s.staffed ?? 0}/${r.s.total})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-label="Vývoj">
        <h3>Vývoj – posledné zmeny</h3>
        {recent.length === 0 ? (
          <p className="muted">Zatiaľ žiadne uzavreté zmeny na porovnanie.</p>
        ) : (
          <TrendChart points={points} label="Obsadenosť ľuďmi v posledných zmenách" picked={idx} onPick={setPicked} />
        )}
      </section>
    </Sheet>
  );
}
