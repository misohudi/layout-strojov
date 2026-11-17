import type { HTMLAttributes } from 'react';
import { ROLE_LABEL, type OrderType, type PersonRole } from '../domain/types';
import { MachineIcon } from './MachineIcon';
import { nickOf } from '../domain/nick';

export interface TilePerson {
  name: string;
  role?: PersonRole;
  /** On how many machines this person works in the shift (viacobsluha when 2+). */
  machines?: number;
}

interface Props {
  name: string;
  /** Short name on the tile; the full name is in the machine detail (and read by screen readers). */
  nick?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: OrderType | null;
  outOfService: boolean;
  /** Priority order – a dark "PRIO" tag on the top edge (only with an order type). */
  priority?: boolean;
  people?: TilePerson[];
  selected?: boolean;
  dragging?: boolean;
  /** Legend highlight: the tile stands out (slight zoom) or is greyed out. */
  highlighted?: boolean;
  dimmed?: boolean;
  onClick?(): void;
  /** Pointer handlers for dragging in the machine editor. */
  dragProps?: Pick<HTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>;
}

export function tileClass(type: OrderType | null, outOfService: boolean) {
  if (outOfService) return 'tile--oos';
  if (type === 'EXT') return 'tile--ext';
  if (type === 'INT') return 'tile--int';
  return 'tile--free';
}

export function MachineTile({
  name, nick, x, y, w, h, type, outOfService, priority, people = [], selected, dragging, highlighted, dimmed, onClick, dragProps,
}: Props) {
  const short = nickOf({ name, nick });
  const first = people[0];
  const isPriority = !!priority && !outOfService && type !== null;
  const figure = outOfService ? 'oos' : !first ? 'none' : first.role === 'operator' ? 'operator' : 'frezar';
  /** Priority order nobody works on – a warning in the corner. */
  const unstaffedPriority = isPriority && people.length === 0;
  const multi = (first?.machines ?? 1) > 1 ? first!.machines! : 0;
  return (
    <button
      type="button"
      data-testid="machine-tile"
      title={name}
      className={`tile ${tileClass(type, outOfService)} ${isPriority ? 'tile--priority' : ''} ${selected ? 'tile--selected' : ''} ${dragging ? 'tile--dragging' : ''} ${highlighted ? 'tile--hl' : ''} ${dimmed ? 'tile--dim' : ''}`}
      style={{
        gridColumn: `${x + 1} / span ${w}`,
        gridRow: `${y + 1} / span ${h}`,
        // a draggable tile must not start scrolling the plan
        touchAction: dragProps ? 'none' : undefined,
      }}
      onClick={onClick}
      {...dragProps}
    >
      {/* portrait tile so the whole hall fits a tablet: icon, nick, person; the role shows in the figure */}
      <MachineIcon figure={figure} />
      <span className="tile__nick" aria-hidden="true">{short}</span>
      <span className="visually-hidden">{name}</span>
      {/* the person line is always there (empty when free), so icon and nick never move */}
      {!first && <span className="tile__person" aria-hidden="true">{' '}</span>}
      {first && (
        <span className="tile__person">
          <span className="tile__person-name">{` ${first.name}`}</span>
          {multi > 0 && (
            <span className="tile__multi" title={`Viacobsluha – ${multi} stroje`}>
              {` ${multi}×`}
              <span className="visually-hidden"> viacobsluha</span>
            </span>
          )}
          {people.length > 1 && <span className="tile__more">{` +${people.length - 1}`}</span>}
        </span>
      )}
      {first && <span className="tile__role visually-hidden">{` ${ROLE_LABEL[first.role ?? 'frezar']}`}</span>}
      {unstaffedPriority && (
        <span className="tile__warn" title="Prioritná zákazka bez obsluhy">
          <svg viewBox="0 0 24 22" aria-hidden="true">
            <path d="M12 1.5L23 20.5H1Z" fill="#facc15" stroke="#111827" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M12 8v6" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="12" cy="17.4" r="1.4" fill="#111827" />
          </svg>
          <span className="visually-hidden"> Prioritná zákazka bez obsluhy</span>
        </span>
      )}
      {isPriority && (
        <span className="prio-badge" title="Prioritná zákazka">
          PRIO<span className="visually-hidden"> – prioritná zákazka</span>
        </span>
      )}
    </button>
  );
}
