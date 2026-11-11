import { useState } from 'react';
import { isPool, type Person, type Shift } from '../domain/types';

interface Props {
  people: Person[];
  shifts: Shift[];
  currentShiftId: string;
  selected: string[];
  /** On how many machines of the current draft each person already works. */
  counts?: Record<string, number>;
  onToggle(id: string): void;
}

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'sk');

const machinesLabel = (n: number) => (n === 1 ? '1 stroj' : n < 5 ? `${n} stroje` : `${n} strojov`);

function PersonCheck({ p, checked, count, onToggle }: { p: Person; checked: boolean; count: number; onToggle(id: string): void }) {
  return (
    <label className={`person ${checked ? 'person--on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(p.id)} />
      <span>{p.name}</span>
      {count > 0 && <small className="person__count">{machinesLabel(count)}</small>}
    </label>
  );
}

export function PeoplePicker({ people, shifts, currentShiftId, selected, counts = {}, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const active = people.filter((p) => p.active);
  const own = active.filter((p) => p.shiftId === currentShiftId).sort(byName);
  const current = shifts.find((s) => s.id === currentShiftId);
  const others = [...shifts]
    .filter((s) => s.id !== currentShiftId)
    .sort((a, b) => Number(isPool(a)) - Number(isPool(b)) || a.order - b.order)
    .map((s) => ({ shift: s, people: active.filter((p) => p.shiftId === s.id).sort(byName) }))
    .filter((g) => g.people.length > 0);
  const selectedOthers = others.flatMap((g) => g.people).filter((p) => selected.includes(p.id));

  return (
    <div className="people-picker">
      <h3>Moja zmena {current?.name}</h3>
      <div className="people-list">
        {own.length === 0 && <p className="muted">Žiadni ľudia – pridajte ich v nastaveniach.</p>}
        {own.map((p) => (
          <PersonCheck key={p.id} p={p} checked={selected.includes(p.id)} count={counts[p.id] ?? 0} onToggle={onToggle} />
        ))}
      </div>
      <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} Iné zmeny (nadčas) a ostatní
      </button>
      {!open && selectedOthers.length > 0 && (
        <div className="people-list">
          {selectedOthers.map((p) => (
            <PersonCheck key={p.id} p={p} checked count={counts[p.id] ?? 0} onToggle={onToggle} />
          ))}
        </div>
      )}
      {open &&
        others.map((g) => (
          <div key={g.shift.id}>
            <h4>{isPool(g.shift) ? g.shift.name : `Zmena ${g.shift.name}`}</h4>
            <div className="people-list">
              {g.people.map((p) => (
                <PersonCheck key={p.id} p={p} checked={selected.includes(p.id)} count={counts[p.id] ?? 0} onToggle={onToggle} />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
