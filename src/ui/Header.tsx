import { formatPct } from '../report/xlsx';
import type { Stats } from '../domain/types';

interface Props {
  shiftName: string;
  foremanName: string;
  stats: Stats;
  onChangeShift(): void;
  onHistory(): void;
  onSettings(): void;
}

export function Header({ shiftName, foremanName, stats, onChangeShift, onHistory, onSettings }: Props) {
  return (
    <header className="header">
      <div className="header__shift">
        <span className="badge">{`Zmena ${shiftName} · ${foremanName}`}</span>
        <button className="btn btn--small" onClick={onChangeShift}>Zmeniť zmenu</button>
      </div>
      <div className="header__stats">
        <strong>{`Obsadenosť ${formatPct(stats.occupancyPct)}`}</strong>
        <span className="stat stat--ext">{`EXT ${formatPct(stats.extPct)}`}</span>
        <span className="stat stat--int">{`INT ${formatPct(stats.intPct)}`}</span>
        <span className="muted">{`${stats.occupied} / ${stats.total} strojov`}</span>
      </div>
      <div className="header__actions">
        <button className="btn btn--small" onClick={onHistory}>História</button>
        <button className="btn btn--small" aria-label="Nastavenia" onClick={onSettings}>⚙</button>
      </div>
    </header>
  );
}
