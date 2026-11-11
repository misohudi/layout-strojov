import type { OrderType } from '../domain/types';

interface Props {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: OrderType | null;
  outOfService: boolean;
  people?: string[];
  selected?: boolean;
  onClick?(): void;
}

export function tileClass(type: OrderType | null, outOfService: boolean) {
  if (outOfService) return 'tile--oos';
  if (type === 'EXT') return 'tile--ext';
  if (type === 'INT') return 'tile--int';
  return 'tile--free';
}

export function MachineTile({ name, x, y, w, h, type, outOfService, people = [], selected, onClick }: Props) {
  return (
    <button
      type="button"
      data-testid="machine-tile"
      className={`tile ${tileClass(type, outOfService)} ${w === 1 ? 'tile--narrow' : ''} ${selected ? 'tile--selected' : ''}`}
      style={{ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` }}
      onClick={onClick}
    >
      <span className="tile__name">{name}</span>
      {people.length > 0 && <span className="tile__people">{people.join(', ')}</span>}
    </button>
  );
}
