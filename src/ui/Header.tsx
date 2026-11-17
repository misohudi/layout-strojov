import type { ReactNode } from 'react';
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

/** One header field: small label on top, value below. Every field has the same size. */
function Cell({ label, value, variant = '', name }: { label: string; value: ReactNode; variant?: string; name?: string }) {
  return (
    <div className={`hcell ${variant}`} role="group" aria-label={name ?? `${label} ${value}`}>
      <span className="hcell__label">{label}</span>
      <strong className="hcell__value">{value}</strong>
    </div>
  );
}

function CellButton({ label, value, name, onClick }: { label: string; value: ReactNode; name: string; onClick(): void }) {
  return (
    <button type="button" className="hcell hcell--btn" aria-label={name} onClick={onClick}>
      <span className="hcell__label">{label}</span>
      <strong className="hcell__value">{value}</strong>
    </button>
  );
}

export function Header({ shiftName, stats, onChangeShift, onHistory, onSettings, onMachineList }: Props) {
  return (
    <header className="header">
      <Cell label="Zmena" value={shiftName} variant="hcell--shift" name={`Zmena ${shiftName}`} />
      <CellButton label="Zmeniť" value="zmenu" name="Zmeniť zmenu" onClick={onChangeShift} />
      <Cell label="Obsadenosť" value={formatPct(stats.staffedPct)} variant="hcell--main" />
      <CellButton
        label="Stroje"
        value={`${stats.staffed ?? 0} / ${stats.total}`}
        name={`${stats.staffed ?? 0} / ${stats.total} strojov`}
        onClick={onMachineList}
      />
      <Cell label="Frézari" value={stats.frezari ?? 0} />
      <Cell label="Operátori" value={stats.operatori ?? 0} />
      <Cell label="Zákazky" value={formatPct(stats.occupancyPct)} />
      <Cell label="EXT" value={formatPct(stats.extPct)} variant="hcell--ext" />
      <Cell label="INT" value={formatPct(stats.intPct)} variant="hcell--int" />
      <CellButton label="Prehľad" value="História" name="História" onClick={onHistory} />
      <CellButton label="Nastavenia" value="⚙" name="Nastavenia" onClick={onSettings} />
    </header>
  );
}
