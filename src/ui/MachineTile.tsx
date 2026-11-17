import type { HTMLAttributes } from 'react';
import { ROLE_LABEL, type OrderType, type PersonRole } from '../domain/types';
import { MachineIcon } from './MachineIcon';

export interface TilePerson {
  name: string;
  role?: PersonRole;
}

interface Props {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: OrderType | null;
  outOfService: boolean;
  /** Priority order – the tile glows and gets a star. */
  priority?: boolean;
  people?: TilePerson[];
  selected?: boolean;
  dragging?: boolean;
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

/** Longest names fit one line by moving their end to a smaller second line: "DMU 80P" / "DUO BLOCK / 1". */
const LONG_NAME = 14;
export function splitName(name: string): [string, string | null] {
  const words = name.trim().split(/\s+/);
  if (name.length <= LONG_NAME || words.length < 3) return [name, null];
  return [words.slice(0, 2).join(' '), words.slice(2).join(' ')];
}

export function MachineTile({
  name, x, y, w, h, type, outOfService, priority, people = [], selected, dragging, onClick, dragProps,
}: Props) {
  const [main, sub] = splitName(name);
  const first = people[0];
  const isPriority = !!priority && !outOfService;
  return (
    <button
      type="button"
      data-testid="machine-tile"
      className={`tile ${tileClass(type, outOfService)} ${isPriority ? 'tile--priority' : ''} ${selected ? 'tile--selected' : ''} ${dragging ? 'tile--dragging' : ''}`}
      style={{
        gridColumn: `${x + 1} / span ${w}`,
        gridRow: `${y + 1} / span ${h}`,
        // a draggable tile must not start scrolling the plan
        touchAction: dragProps ? 'none' : undefined,
      }}
      onClick={onClick}
      {...dragProps}
    >
      <MachineIcon staffed={people.length > 0} />
      <span className="tile__text">
        <span className="tile__name">{main}</span>
        {sub && <span className="tile__name-sub">{` ${sub}`}</span>}
        {first && (
          <span className="tile__person">
            <span className="tile__person-name">{` ${first.name}`}</span>
            {people.length > 1 && <span className="tile__more">{` +${people.length - 1}`}</span>}
          </span>
        )}
        {first && <span className="tile__role">{` ${ROLE_LABEL[first.role ?? 'frezar']}`}</span>}
      </span>
      {isPriority && (
        <>
          <span className="tile__star" aria-hidden="true">★</span>
          <span className="visually-hidden"> Prioritná zákazka</span>
        </>
      )}
    </button>
  );
}
