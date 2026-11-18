import { useId, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatPct } from '../report/xlsx';
import { AutoThemeIcon, GearIcon, HistoryIcon, MoonIcon, SunIcon, svg } from './icons';
import { useDB } from './useDB';
import { loadTheme, nextTheme, saveTheme, themeLabel } from './theme';
import type { PersonRole, Stats } from '../domain/types';

interface Props {
  shiftName: string;
  /** Length of the longest shift (foreman) name: the shift button is that wide for every shift. */
  longestShiftName?: number;
  stats: Stats;
  onChangeShift(): void;
  onHistory(): void;
  onSettings(): void;
  onMachineList(): void;
  /** Tap on Frézari / Operátori: the list of people of that role. */
  onPeopleList(role: PersonRole): void;
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

/** Appearance: the icon shows the current mode, a tap switches to the next one. */
function ThemeButton() {
  const db = useDB();
  const maskId = `theme-a-${useId().replace(/:/g, '')}`;
  const theme = useLiveQuery(() => loadTheme(db), [db]) ?? 'light';
  const next = nextTheme(theme);
  const icon = theme === 'dark' ? <MoonIcon /> : theme === 'system' ? <AutoThemeIcon id={maskId} /> : <SunIcon />;
  return (
    <IconButton
      name={`Vzhľad: ${themeLabel(theme)} – prepnúť na ${themeLabel(next)}`}
      icon={icon}
      onClick={() => saveTheme(db, next)}
    />
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

/**
 * A group of related fields: the shift on the left, occupancy by people in the middle, the app's
 * buttons on the right. No visible frame or title – the title is for screen readers only.
 */
function Section({ title, place, children }: { title: string; place: 'start' | 'center' | 'end'; children: ReactNode }) {
  return (
    <section className={`hgroup hgroup--${place}`} aria-label={title}>
      <h2 className="visually-hidden">{title}</h2>
      {children}
    </section>
  );
}

export function Header({ shiftName, longestShiftName = 0, stats, onChangeShift, onHistory, onSettings, onMachineList, onPeopleList }: Props) {
  return (
    <header className="header">
      <Section title="Zmena" place="start">
        {/* tap the shift to switch to another one */}
        <CellButton
          label="Zmena"
          // wide enough for the longest name even in capitals (bold capitals are ~1.2 × a digit) plus a reserve
          value={<span style={{ minWidth: `${Math.ceil(Math.max(longestShiftName, shiftName.length) * 1.2) + 2}ch` }}>{shiftName}</span>}
          variant="hcell--shift"
          name={`Zmena ${shiftName} – zmeniť zmenu`}
          onClick={onChangeShift}
        />
      </Section>
      <Section title="Obsadenosť ľuďmi" place="center">
        <Cell label="Obsadenosť" value={formatPct(stats.staffedPct)} variant="hcell--main" />
        <CellButton
          label="Stroje"
          value={`${stats.staffed ?? 0} / ${stats.total}`}
          name={`${stats.staffed ?? 0} / ${stats.total} strojov`}
          onClick={onMachineList}
        />
        <CellButton label="Frézari" value={stats.frezari ?? 0} name={`Frézari ${stats.frezari ?? 0} – zoznam ľudí`} onClick={() => onPeopleList('frezar')} />
        <CellButton label="Operátori" value={stats.operatori ?? 0} name={`Operátori ${stats.operatori ?? 0} – zoznam ľudí`} onClick={() => onPeopleList('operator')} />
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
      <Section title="Aplikácia" place="end">
        <ThemeButton />
        <IconButton name="História" icon={<HistoryIcon />} onClick={onHistory} />
        <IconButton name="Nastavenia" icon={<GearIcon />} onClick={onSettings} />
      </Section>
    </header>
  );
}
