import { useRef, type TouchEvent } from 'react';
import { useDB } from './useDB';
import { BackIcon } from './icons';
import { setMachinePriority, setMachineType, togglePerson } from '../db/repo';
import { PeoplePicker } from './PeoplePicker';
import type { Assignment, Machine, OrderType, Person, Shift } from '../domain/types';

interface Props {
  machine: Machine;
  assignment: Assignment | undefined;
  shiftId: string;
  people: Person[];
  shifts: Shift[];
  counts?: Record<string, number>;
  /** Paging through the machines without closing the card (swipe or the arrows). */
  onPrev?(): void;
  onNext?(): void;
  /** Where the card came from when paged: it slides in from that side. */
  enter?: 'left' | 'right' | null;
  /** "12 / 39" – this machine's place in the plan's order. */
  position?: string;
  onClose(): void;
}

/** A swipe: one finger, mostly sideways, at least this far. */
const SWIPE_PX = 60;

const TYPES: { label: string; value: OrderType | null; cls: string }[] = [
  { label: 'EXT', value: 'EXT', cls: 'btn--ext' },
  { label: 'INT', value: 'INT', cls: 'btn--int' },
  { label: 'Voľný', value: null, cls: '' },
];

export function MachinePanel({ machine, assignment, shiftId, people, shifts, counts, onPrev, onNext, enter, position, onClose }: Props) {
  const db = useDB();
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    swipe.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    const t = e.changedTouches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    // finger to the left = the next machine (like turning a page)
    if (dx < 0) onNext?.();
    else onPrev?.();
  };
  const type = assignment?.type ?? null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet ${enter ? `sheet--enter-${enter}` : ''}`}
        role="dialog"
        aria-label={machine.name}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* name, order type and priority stay in place while the list of people scrolls */}
        <div className="sheet__top">
          <div className="sheet__head">
            <h2>{machine.name}</h2>
            <div className="row machine-pager">
              {(onPrev || onNext) && (
                <>
                  <button type="button" className="chip chip--round" aria-label="Predchádzajúci stroj" disabled={!onPrev} onClick={onPrev}>
                    <BackIcon />
                  </button>
                  {position && <span className="muted machine-pager__pos">{position}</span>}
                  <button type="button" className="chip chip--round machine-pager__next" aria-label="Ďalší stroj" disabled={!onNext} onClick={onNext}>
                    <BackIcon />
                  </button>
                </>
              )}
              <button className="btn" onClick={onClose}>Hotovo</button>
            </div>
          </div>
          {machine.status !== 'active' ? (
            <p className="muted">Stroj je mimo prevádzky. Zmeniť to môžete v nastaveniach strojov.</p>
          ) : (
            <>
              <div className="row">
                {TYPES.map((t) => (
                  <button
                    key={t.label}
                    className={`btn btn--type ${t.cls} ${type === t.value ? 'btn--selected' : ''}`}
                    aria-pressed={type === t.value}
                    onClick={() => setMachineType(db, shiftId, machine.id, t.value)}
                  >
                    {t.label}
                  </button>
                ))}
                {/* priority in the same row, yellow like the PRIO tag on the tile */}
                <button
                  className={`btn btn--type btn--priority ${type && assignment?.priority ? 'btn--priority-on' : ''}`}
                  aria-pressed={!!type && !!assignment?.priority}
                  aria-label={type && assignment?.priority ? 'PRIO · prioritná zákazka' : 'PRIO – označiť ako prioritnú zákazku'}
                  disabled={!type}
                  aria-describedby={type ? undefined : 'priority-hint'}
                  onClick={() => setMachinePriority(db, shiftId, machine.id, !assignment?.priority)}
                >
                  PRIO
                </button>
              </div>
              {!type && <p id="priority-hint" className="muted priority-hint">Prioritu môžete zvoliť až po výbere EXT alebo INT.</p>}
            </>
          )}
        </div>
        {machine.status === 'active' && (
          <PeoplePicker
            people={people}
            shifts={shifts}
            currentShiftId={shiftId}
            selected={assignment?.personIds ?? []}
            counts={counts}
            onToggle={(pid) => togglePerson(db, shiftId, machine.id, pid)}
          />
        )}
      </div>
    </div>
  );
}
