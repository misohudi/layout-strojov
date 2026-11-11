import { formatPct } from '../report/xlsx';
import { tileClass } from './MachineTile';
import type { Assignment, Machine, Stats } from '../domain/types';

interface Props {
  machines: Machine[];
  assignments: Record<string, Assignment>;
  stats: Stats;
  nameOf: Map<string, string>;
  onPick(machineId: string): void;
  onClose(): void;
}

const byPosition = (a: Machine, b: Machine) => a.y - b.y || a.x - b.x;

/** Overview of all machines of the current shift: order type and people; tap a row to edit it. */
export function MachineList({ machines, assignments, stats, nameOf, onPick, onClose }: Props) {
  const sorted = [...machines].sort(byPosition);
  const active = sorted.filter((m) => m.status === 'active');
  const inactive = sorted.filter((m) => m.status !== 'active');

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--tall" role="dialog" aria-label="Zoznam strojov" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2>Zoznam strojov</h2>
          <button className="btn" onClick={onClose}>Zavrieť</button>
        </div>
        <p>
          <strong>{`Obsadenosť ${formatPct(stats.occupancyPct)}`}</strong>
          {` · ${stats.occupied} / ${stats.total} strojov v prevádzke · EXT ${stats.ext} · INT ${stats.int}`}
        </p>
        <div className="table-wrap">
          <table aria-label="V prevádzke" className="machine-list">
            <thead>
              <tr><th>Stroj</th><th>Zakázka</th><th>Ľudia</th></tr>
            </thead>
            <tbody>
              {active.map((m) => {
                const a = assignments[m.id];
                const type = a?.type ?? null;
                const people = (a?.personIds ?? []).map((id) => nameOf.get(id) ?? '?');
                return (
                  <tr key={m.id} className="clickable" onClick={() => onPick(m.id)}>
                    <td>{m.name}</td>
                    <td><span className={`type-badge ${tileClass(type, false)}`}>{type ?? 'voľný'}</span></td>
                    <td>{people.join(', ')}</td>
                  </tr>
                );
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
                    <tr key={m.id}><td>{m.name}</td></tr>
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
