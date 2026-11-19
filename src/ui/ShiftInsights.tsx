import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from './useDB';
import { listRecords } from '../db/repo';
import { computeStats, multiText } from '../domain/stats';
import { byHallAndPosition } from '../domain/record';
import { formatPct, skDate } from '../report/xlsx';
import { tileClass } from './MachineTile';
import { justDropped } from './dragPerson';
import { roleOf, ROLE_LABEL, type Assignment, type Hall, type Machine, type Person, type Stats } from '../domain/types';

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

/** Last closed shifts in the trend chart. */
export const TREND_SHIFTS = 14;

/** A figure of the closed shifts (oldest first) plus the open one ("teraz"), as bars. */
function TrendChart({ points, label }: { points: { label: string; sub: string; pct: number | null; now?: boolean }[]; label: string }) {
  const [picked, setPicked] = useState<number>(points.length - 1);
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
            <g key={i} className={`trend__bar ${p.now ? 'trend__bar--now' : ''} ${i === picked ? 'trend__bar--on' : ''}`} onClick={() => setPicked(i)}>
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
          <span className="muted"> – ťuknutím na stĺpec zobrazíte hodnotu</span>
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
  const points = [
    ...recent.map((r) => ({ label: skDate(r.date).replace(/\d{4}$/, ''), sub: r.shiftName, pct: r.stats.occupancyPct })),
    { label: 'teraz', sub: '', pct: stats.occupancyPct, now: true },
  ];
  const rows = [
    ...(halls.length > 1
      ? halls.map((h) => ({ name: h.name, s: computeStats(machines.filter((m) => m.hallId === h.id), assignments) }))
      : []),
    { name: 'Spolu', s: stats, total: true },
  ];
  return (
    <Sheet title="Vyťaženie strojov" onClose={onClose}>
      <p className="insight__lead">
        <strong>{formatPct(stats.occupancyPct)}</strong>
        {` · ${stats.occupied} / ${stats.total} strojov v prevádzke má zákazku`}
      </p>
      <section aria-label="Rozpis teraz">
        <h3>Rozpis teraz</h3>
        <div className="table-wrap">
          <table className="insight__table">
            <thead>
              <tr><th>{halls.length > 1 ? 'Oddelenie' : ''}</th><th>EXT</th><th>INT</th><th>Voľné</th><th>Mimo prev.</th><th>Vyťaženie</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={'total' in r ? 'insight__total' : ''}>
                  <td>{r.name}</td>
                  <td>{r.s.ext}</td>
                  <td>{r.s.int}</td>
                  <td>{r.s.free ?? 0}</td>
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
          <TrendChart points={points} label="Vyťaženie strojov v posledných zmenách" />
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
  const points = [
    ...recent.map((r) => ({ label: skDate(r.date).replace(/\d{4}$/, ''), sub: r.shiftName, pct: r.stats.staffedPct ?? null })),
    { label: 'teraz', sub: '', pct: stats.staffedPct ?? null, now: true },
  ];
  const rows = [
    ...(halls.length > 1
      ? halls.map((h) => ({ name: h.name, s: computeStats(machines.filter((m) => m.hallId === h.id), assignments, people) }))
      : []),
    { name: 'Spolu', s: stats, total: true },
  ];
  return (
    <Sheet title="Obsadenosť ľuďmi" onClose={onClose}>
      <p className="insight__lead">
        <strong>{formatPct(stats.staffedPct ?? null)}</strong>
        {` · ${stats.staffed ?? 0} / ${stats.total} strojov v prevádzke má ľudí`}
      </p>
      <section aria-label="Rozpis teraz">
        <h3>Rozpis teraz</h3>
        <div className="table-wrap">
          <table className="insight__table">
            <thead>
              <tr><th>{halls.length > 1 ? 'Oddelenie' : ''}</th><th>S ľuďmi</th><th>Bez ľudí</th><th>Frézari</th><th>Operátori</th><th>Viacobsluha</th><th>Obsadenosť</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={'total' in r ? 'insight__total' : ''}>
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
          <TrendChart points={points} label="Obsadenosť ľuďmi v posledných zmenách" />
        )}
      </section>
    </Sheet>
  );
}
