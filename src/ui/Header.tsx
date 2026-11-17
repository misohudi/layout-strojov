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

/** Section padding + border (both sides) and the gap between fields – must match .hsection in styles.css. */
const SECTION_EDGE = 14;
const FIELD_GAP = 6;

/**
 * A group of related fields with a small title. The section starts at the width of its own edges and
 * gaps and grows by the number of fields, so every field in the header ends up equally wide.
 */
function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="hsection" aria-label={title} style={{ flex: `${count} 1 ${SECTION_EDGE + FIELD_GAP * (count - 1)}px` }}>
      <h2 className="hsection__title">{title}</h2>
      <div className="hsection__cells">{children}</div>
    </section>
  );
}

export function Header({ shiftName, stats, onChangeShift, onHistory, onSettings, onMachineList }: Props) {
  return (
    <header className="header">
      <Section title="Zmena" count={2}>
        <Cell label="Zmena" value={shiftName} variant="hcell--shift" name={`Zmena ${shiftName}`} />
        <CellButton label="Zmeniť" value="zmenu" name="Zmeniť zmenu" onClick={onChangeShift} />
      </Section>
      <Section title="Obsadenosť ľuďmi" count={4}>
        <Cell label="Obsadenosť" value={formatPct(stats.staffedPct)} variant="hcell--main" />
        <CellButton
          label="Stroje"
          value={`${stats.staffed ?? 0} / ${stats.total}`}
          name={`${stats.staffed ?? 0} / ${stats.total} strojov`}
          onClick={onMachineList}
        />
        <Cell label="Frézari" value={stats.frezari ?? 0} />
        <Cell label="Operátori" value={stats.operatori ?? 0} />
      </Section>
      <Section title="Zákazky" count={3}>
        <Cell label="Obsadenosť" value={formatPct(stats.occupancyPct)} name={`Zákazky ${formatPct(stats.occupancyPct)}`} />
        <Cell label="EXT" value={formatPct(stats.extPct)} variant="hcell--ext" />
        <Cell label="INT" value={formatPct(stats.intPct)} variant="hcell--int" />
      </Section>
      <Section title="Aplikácia" count={2}>
        <CellButton label="Prehľad" value="História" name="História" onClick={onHistory} />
        <CellButton label="Nastavenia" value="⚙" name="Nastavenia" onClick={onSettings} />
      </Section>
    </header>
  );
}
