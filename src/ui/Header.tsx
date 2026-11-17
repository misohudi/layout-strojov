import { formatPct } from '../report/xlsx';
import type { Stats } from '../domain/types';

interface Props {
  shiftName: string;
  stats: Stats;
  onChangeShift(): void;
  onHistory(): void;
  onSettings(): void;
  onMachineList(): void;
}

export function Header({ shiftName, stats, onChangeShift, onHistory, onSettings, onMachineList }: Props) {
  return (
    <header className="header">
      <div className="header__shift">
        <span className="badge">{`Zmena ${shiftName}`}</span>
        <button className="btn btn--small" onClick={onChangeShift}>Zmeniť zmenu</button>
      </div>
      <div className="header__stats">
        <strong>{`Obsadenosť ${formatPct(stats.staffedPct)}`}</strong>
        <button className="btn btn--small btn--count" onClick={onMachineList}>{`${stats.staffed ?? 0} / ${stats.total} strojov`}</button>
        <span className="stat stat--role">{`Frézari ${stats.frezari ?? 0}`}</span>
        <span className="stat stat--role">{`Operátori ${stats.operatori ?? 0}`}</span>
        <span className="header__orders">
          <span>{`Zákazky ${formatPct(stats.occupancyPct)}`}</span>
          <span className="stat stat--ext">{`EXT ${formatPct(stats.extPct)}`}</span>
          <span className="stat stat--int">{`INT ${formatPct(stats.intPct)}`}</span>
        </span>
      </div>
      <div className="header__actions">
        <button className="btn btn--small" onClick={onHistory}>História</button>
        <button className="btn btn--small" aria-label="Nastavenia" onClick={onSettings}>⚙</button>
      </div>
    </header>
  );
}
