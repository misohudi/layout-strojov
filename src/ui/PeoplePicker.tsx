import { useState } from 'react';
import type { Person, Shift } from '../domain/types';

interface Props {
  people: Person[];
  shifts: Shift[];
  currentShiftId: string;
  selected: string[];
  onToggle(id: string): void;
}

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'sk');

function PersonCheck({ p, checked, onToggle }: { p: Person; checked: boolean; onToggle(id: string): void }) {
  return (
    <label className={`person ${checked ? 'person--on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(p.id)} />
      <span>{p.name}</span>
    </label>
  );
}

export function PeoplePicker({ people, shifts, currentShiftId, selected, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const active = people.filter((p) => p.active);
  const own = active.filter((p) => p.shiftId === currentShiftId).sort(byName);
  const current = shifts.find((s) => s.id === currentShiftId);
  const others = [...shifts]
    .filter((s) => s.id !== currentShiftId)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ shift: s, people: active.filter((p) => p.shiftId === s.id).sort(byName) }))
    .filter((g) => g.people.length > 0);
  const selectedOthers = others.flatMap((g) => g.people).filter((p) => selected.includes(p.id));

  return (
    <div className="people-picker">
      <h3>Moja zmena {current?.name}</h3>
      <div className="people-list">
        {own.length === 0 && <p className="muted">Žiadni ľudia – pridajte ich v nastaveniach.</p>}
        {own.map((p) => (
          <PersonCheck key={p.id} p={p} checked={selected.includes(p.id)} onToggle={onToggle} />
        ))}
      </div>
      <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} Iné zmeny (nadčas)
      </button>
      {!open && selectedOthers.length > 0 && (
        <div className="people-list">
          {selectedOthers.map((p) => (
            <PersonCheck key={p.id} p={p} checked onToggle={onToggle} />
          ))}
        </div>
      )}
      {open &&
        others.map((g) => (
          <div key={g.shift.id}>
            <h4>Zmena {g.shift.name}</h4>
            <div className="people-list">
              {g.people.map((p) => (
                <PersonCheck key={p.id} p={p} checked={selected.includes(p.id)} onToggle={onToggle} />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
