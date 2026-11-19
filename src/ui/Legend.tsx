import type { ReactNode } from 'react';
import { formatPct } from '../report/xlsx';
import { HexOutlines } from './Brand';
import type { Assignment, Machine, Stats } from '../domain/types';

export type LegendKey = 'EXT' | 'INT' | 'free' | 'oos' | 'prio';

/** Does a machine belong to a legend item? Used to highlight those machines on the plan. */
export function matchesLegend(key: LegendKey, m: Machine, a: Assignment | undefined): boolean {
  const active = m.status === 'active';
  switch (key) {
    case 'EXT':
    case 'INT':
      return active && a?.type === key;
    case 'free':
      return active && !a?.type;
    case 'oos':
      return !active;
    case 'prio':
      return active && !!a?.type && !!a.priority;
  }
}

interface Props {
  stats: Stats;
  /** Highlighted legend item (its machines are zoomed slightly, the rest greyed out). */
  selected: LegendKey | null;
  onSelect(key: LegendKey | null): void;
  /** Buttons on the right (Vyčistiť, Uzavrieť…). */
  children: ReactNode;
}

export function Legend({ stats, selected, onSelect, children }: Props) {
  // short labels on screen so the legend, "Vyťaženie strojov" and the actions fit one row; full names for screen readers
  const items: { key: LegendKey; label: string; short: string; mark: ReactNode; count: number; pct?: number | null }[] = [
    { key: 'EXT', label: 'EXT – externá', short: 'EXT', mark: <i className="sw tile--ext" />, count: stats.ext, pct: stats.extPct },
    { key: 'INT', label: 'INT – interná', short: 'INT', mark: <i className="sw tile--int" />, count: stats.int, pct: stats.intPct },
    { key: 'free', label: 'voľný', short: 'voľný', mark: <i className="sw tile--free" />, count: stats.free ?? 0 },
    { key: 'oos', label: 'mimo prevádzky', short: 'mimo prev.', mark: <i className="sw tile--oos" />, count: stats.oos ?? 0 },
    {
      key: 'prio', label: 'prioritná zákazka', short: '',
      mark: <span className="prio-badge prio-badge--inline">PRIO</span>, count: stats.prio ?? 0,
    },
  ];
  return (
    <div className="legend">
      <HexOutlines className="legend__hexes" />
      {/* legend + "Vyťaženie strojov" always stay together; only the actions wrap to a new row on narrow screens */}
      <div className="legend__info">
        <div className="legend__items" role="group" aria-label="Legenda – ťuknutím zvýrazníte stroje">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              className={`legend__item ${selected === it.key ? 'legend__item--on' : ''}`}
              aria-pressed={selected === it.key}
              aria-label={`${it.label}: ${it.count}${it.pct !== undefined ? `, ${formatPct(it.pct)}` : ''}`}
              onClick={() => onSelect(selected === it.key ? null : it.key)}
            >
              <span className="legend__row">
                {it.mark}
                {it.short && <span className="legend__label" title={it.label}>{it.short}</span>}
                <span className="legend__count">{it.count}</span>
              </span>
              {it.pct !== undefined && <small className="legend__pct">{formatPct(it.pct)}</small>}
            </button>
          ))}
        </div>
        <div className="legend__stat" role="group" aria-label={`Vyťaženie strojov ${formatPct(stats.occupancyPct)}`}>
          <span className="legend__stat-label">Vyťaženie strojov</span>
          <strong className="legend__stat-value">{formatPct(stats.occupancyPct)}</strong>
          <small className="legend__stat-sub">{`${stats.occupied} / ${stats.total} so zákazkou`}</small>
        </div>
      </div>
      <div className="legend__actions">{children}</div>
    </div>
  );
}
