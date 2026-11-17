import type { ReactNode } from 'react';
import { formatPct } from '../report/xlsx';
import { GearIcon, svg } from './icons';
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

function CellButton({ label, value, name, variant = '', onClick }: { label: string; value: ReactNode; name: string; variant?: string; onClick(): void }) {
  return (
    <button type="button" className={`hcell hcell--btn ${variant}`} aria-label={name} title={name} onClick={onClick}>
      <span className="hcell__label">{label}</span>
      <strong className="hcell__value">{value}</strong>
    </button>
  );
}

/** Icon-only button: a square instead of a field with a label. */
function IconButton({ name, icon, onClick }: { name: string; icon: ReactNode; onClick(): void }) {
  return (
    <button type="button" className="hcell hcell--btn hcell--icon" aria-label={name} title={name} onClick={onClick}>
      {icon}
    </button>
  );
}

/** Small person and machine pictograms for the viacobsluha count. */
const PersonIcon = () => (
  <svg {...svg} className="hicon hicon--sm" data-testid="icon-people">
    <circle cx="12" cy="7" r="3.5" />
    <path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
  </svg>
);
const MachineIconSmall = () => (
  <svg {...svg} className="hicon hicon--sm" data-testid="icon-machines">
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <rect x="6.5" y="7.5" width="7" height="7" rx="1" />
    <path d="M16.5 8v2M16.5 13v1M6 21h12" />
  </svg>
);

/** Section padding + border (both sides) and the gap between fields – must match .hsection in styles.css. */
const SECTION_EDGE = 14;
const FIELD_GAP = 6;
/** Width of an icon-only button – must match .hcell--icon in styles.css. */
const ICON_W = 48;

/**
 * A group of related fields with a small title. The section starts at the width of its own edges and
 * gaps and grows by the number of fields, so every field in the header ends up equally wide.
 */
function Section({ title, count, icons = 0, children }: { title: string; count: number; icons?: number; children: ReactNode }) {
  const basis = SECTION_EDGE + FIELD_GAP * (count + icons - 1) + ICON_W * icons;
  return (
    <section className="hsection" aria-label={title} style={{ flex: `${count} 1 ${basis}px` }}>
      <h2 className="hsection__title">{title}</h2>
      <div className="hsection__cells">{children}</div>
    </section>
  );
}

export function Header({ shiftName, stats, onChangeShift, onHistory, onSettings, onMachineList }: Props) {
  return (
    <header className="header">
      <Section title="Zmena" count={1}>
        {/* tap the shift to switch to another one */}
        <CellButton label="Zmena" value={shiftName} variant="hcell--shift" name={`Zmena ${shiftName} – zmeniť zmenu`} onClick={onChangeShift} />
      </Section>
      <Section title="Obsadenosť ľuďmi" count={5}>
        <Cell label="Obsadenosť" value={formatPct(stats.staffedPct)} variant="hcell--main" />
        <CellButton
          label="Stroje"
          value={`${stats.staffed ?? 0} / ${stats.total}`}
          name={`${stats.staffed ?? 0} / ${stats.total} strojov`}
          onClick={onMachineList}
        />
        <Cell label="Frézari" value={stats.frezari ?? 0} />
        <Cell label="Operátori" value={stats.operatori ?? 0} />
        <Cell
          label="Viacobsluha"
          value={
            <span className="hcell__multi">
              <PersonIcon />
              {stats.multiPeople ?? 0}
              <span className="hcell__sep">/</span>
              <MachineIconSmall />
              {stats.multiMachines ?? 0}
            </span>
          }
          name={`Viacobsluha ${stats.multiPeople ?? 0} ľudí na ${stats.multiMachines ?? 0} strojoch`}
        />
      </Section>
      <Section title="Aplikácia" count={1} icons={1}>
        <CellButton label="Prehľad" value="História" name="História" onClick={onHistory} />
        <IconButton name="Nastavenia" icon={<GearIcon />} onClick={onSettings} />
      </Section>
    </header>
  );
}
