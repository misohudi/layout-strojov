import { useDB } from './useDB';
import { setMachineType, togglePerson } from '../db/repo';
import { PeoplePicker } from './PeoplePicker';
import type { Assignment, Machine, OrderType, Person, Shift } from '../domain/types';

interface Props {
  machine: Machine;
  assignment: Assignment | undefined;
  shiftId: string;
  people: Person[];
  shifts: Shift[];
  counts?: Record<string, number>;
  onClose(): void;
}

const TYPES: { label: string; value: OrderType | null; cls: string }[] = [
  { label: 'EXT', value: 'EXT', cls: 'btn--ext' },
  { label: 'INT', value: 'INT', cls: 'btn--int' },
  { label: 'Voľný', value: null, cls: '' },
];

export function MachinePanel({ machine, assignment, shiftId, people, shifts, counts, onClose }: Props) {
  const db = useDB();
  const type = assignment?.type ?? null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={machine.name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2>{machine.name}</h2>
          <button className="btn" onClick={onClose}>Hotovo</button>
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
            </div>
            <PeoplePicker
              people={people}
              shifts={shifts}
              currentShiftId={shiftId}
              selected={assignment?.personIds ?? []}
              counts={counts}
              onToggle={(pid) => togglePerson(db, shiftId, machine.id, pid)}
            />
          </>
        )}
      </div>
    </div>
  );
}
