import { formatPct } from '../report/xlsx';
import { tileClass } from './MachineTile';
import { byHallAndPosition } from '../domain/record';
import type { Assignment, Hall, Machine, Stats } from '../domain/types';

interface Props {
  machines: Machine[];
  /** Zones of the department; with more than one, the list is split by zone. */
  halls?: Hall[];
  assignments: Record<string, Assignment>;
  stats: Stats;
  nameOf: Map<string, string>;
  onPick(machineId: string): void;
  onClose(): void;
}

/** Overview of all machines of the current shift: order type and people; tap a row to edit it. */
export function MachineList({ machines, halls = [], assignments, stats, nameOf, onPick, onClose }: Props) {
  const sorted = [...machines].sort(byHallAndPosition(halls));
  const hallName = new Map(halls.map((h) => [h.id, h.name]));
  /** Zone heading before the first machine of each zone (only with several zones). */
  const zoneStart = (list: Machine[], i: number) =>
    halls.length > 1 && (i === 0 || list[i - 1].hallId !== list[i].hallId) ? hallName.get(list[i].hallId) ?? '' : null;
  const active = sorted.filter((m) => m.status === 'active');
  const inactive = sorted.filter((m) => m.status !== 'active');

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--tall" role="dialog" aria-label="Zoznam strojov" onClick={(e) => e.stopPropagation()}>
        {/* title and summary stay in place while the list scrolls */}
        <div className="sheet__top">
          <div className="sheet__head">
            <h2>Zoznam strojov</h2>
            <button className="btn" onClick={onClose}>Zavrieť</button>
          </div>
          <p>
            <strong>{`Obsadenosť ${formatPct(stats.staffedPct)}`}</strong>
            {` · ${stats.staffed ?? 0} / ${stats.total} strojov s ľuďmi · Frézari ${stats.frezari ?? 0} · Operátori ${stats.operatori ?? 0} · Viacobsluha ${stats.multiPeople ?? 0} ľ / ${stats.multiMachines ?? 0} str`}
            <br />
            <span className="muted">
              {`Vyťaženie strojov ${formatPct(stats.occupancyPct)} (${stats.occupied}) · EXT ${stats.ext} · INT ${stats.int}`}
            </span>
          </p>
        </div>
        <div className="table-wrap">
          <table aria-label="V prevádzke" className="machine-list">
            <thead>
              <tr><th>Stroj</th><th>Zakázka</th><th>Ľudia</th></tr>
            </thead>
            <tbody>
              {active.map((m, i) => {
                const a = assignments[m.id];
                const type = a?.type ?? null;
                const people = (a?.personIds ?? []).map((id) => nameOf.get(id) ?? '?');
                const zone = zoneStart(active, i);
                return [
                  zone !== null && (
                    <tr key={`zone-${m.hallId}`} className="machine-list__zone"><th colSpan={3}>{zone}</th></tr>
                  ),
                  <tr key={m.id} className="clickable" onClick={() => onPick(m.id)}>
                    <td>
                      {a?.priority && a.type && <span className="prio-badge prio-badge--inline" title="Prioritná zákazka">PRIO</span>}
                      {m.name}
                    </td>
                    <td><span className={`type-badge ${tileClass(type, false)}`}>{type ?? 'voľný'}</span></td>
                    <td>{people.join(', ')}</td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
        {inactive.length > 0 && (
          <>
            <h3>Mimo prevádzky</h3>
            <div className="table-wrap">
              <table aria-label="Mimo prevádzky" className="machine-list muted">
                <tbody>
                  {inactive.map((m) => (
                    <tr key={m.id}><td>{m.name}{halls.length > 1 && <span className="muted">{` · ${hallName.get(m.hallId) ?? ''}`}</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
