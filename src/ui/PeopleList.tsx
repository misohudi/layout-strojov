import { useState } from 'react';
import { useDB } from './useDB';
import { setMachineType, togglePerson } from '../db/repo';
import { justDropped, usePersonDrag } from './dragPerson';
import { nickOf } from '../domain/nick';
import { byHallAndPosition } from '../domain/record';
import { isPool, roleOf, ROLE_LABEL, type Assignment, type Hall, type Machine, type OrderType, type Person, type PersonRole, type Shift } from '../domain/types';

interface Props {
  people: Person[];
  shifts: Shift[];
  currentShiftId: string;
  machines: Machine[];
  halls?: Hall[];
  assignments: Record<string, Assignment>;
  /** Role shown first: the header field that was tapped. */
  initialRole: PersonRole;
  /** A person dragged onto a machine on the plan. */
  onPlace?(personId: string, machineId: string): unknown;
  onClose(): void;
}

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'sk');

const ROLES: { value: PersonRole; label: string }[] = [
  { value: 'frezar', label: 'Frézari' },
  { value: 'operator', label: 'Operátori' },
];

const TYPES: { label: string; value: OrderType | null; cls: string }[] = [
  { label: 'EXT', value: 'EXT', cls: 'btn--ext' },
  { label: 'INT', value: 'INT', cls: 'btn--int' },
  { label: 'Voľný', value: null, cls: '' },
];

/**
 * People of the department by shift (own shift first, then the other shifts, then "Ostatní"), with
 * the machines they work on and the order type there. Tapping a person assigns machines and order types.
 */
export function PeopleList({ people, shifts, currentShiftId, machines, halls = [], assignments, initialRole, onPlace = () => {}, onClose }: Props) {
  const drag = usePersonDrag(onPlace);
  const [role, setRole] = useState<PersonRole>(initialRole);
  const [openId, setOpenId] = useState<string | null>(null);
  const active = machines.filter((m) => m.status === 'active').sort(byHallAndPosition(halls));
  const machinesOf = (pid: string) => active.filter((m) => assignments[m.id]?.personIds.includes(pid));
  const shown = people.filter((p) => p.active && roleOf(p) === role);
  const sections = [...shifts]
    .sort((a, b) => Number(b.id === currentShiftId) - Number(a.id === currentShiftId) || Number(isPool(a)) - Number(isPool(b)) || a.order - b.order)
    .map((s) => ({
      shift: s,
      title: s.id === currentShiftId ? `Moja zmena ${s.name}` : isPool(s) ? s.name : `Zmena ${s.name}`,
      people: shown.filter((p) => p.shiftId === s.id).sort(byName),
    }))
    .filter((g) => g.people.length > 0);
  const own = sections.find((g) => g.shift.id === currentShiftId);
  const others = sections.filter((g) => g.shift.id !== currentShiftId);
  const [othersOpen, setOthersOpen] = useState(false);
  /** Folded away, people of other shifts already on machines still show. */
  const othersOnMachines = others.flatMap((g) => g.people).filter((p) => machinesOf(p.id).length > 0);
  const open = people.find((p) => p.id === openId);
  const personBadge = (p: Person) => {
    const mine = machinesOf(p.id);
    return (
      <button
        key={p.id}
        type="button"
        className={`person person--drag ${mine.length ? 'person--on' : ''}`}
        aria-label={mine.length ? `${p.name} – ${mine.map((m) => m.name).join(', ')}` : `${p.name} – voľný`}
        {...drag.bind(p.id)}
        onClick={() => setOpenId(p.id)}
      >
        <span>{p.name}</span>
        <small className="person__count">{mine.length > 0 ? mine.map((m) => nickOf(m)).join(' · ') : 'voľný'}</small>
      </button>
    );
  };

  if (open) {
    return (
      <PersonPanel
        person={open}
        people={people}
        shiftId={currentShiftId}
        machines={active}
        halls={halls}
        assignments={assignments}
        onClose={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="sheet-backdrop sheet-backdrop--light sheet-backdrop--drag" onClick={() => !justDropped() && onClose()}>
      <div className="sheet sheet--tall sheet--see-through" role="dialog" aria-label="Zoznam ľudí" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__top">
          <div className="sheet__head">
            <h2>Zoznam ľudí</h2>
            <button className="btn" onClick={onClose}>Zavrieť</button>
          </div>
          <div className="row" role="group" aria-label="Rola">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                className={`chip ${role === r.value ? 'chip--on' : ''}`}
                aria-pressed={role === r.value}
                onClick={() => setRole(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="muted drag-hint">Človeka podržte a potiahnite na stroj. Ťuknutím otvoríte jeho stroje.</p>
        </div>
        {sections.length === 0 && <p className="muted">Žiadni ľudia – pridajte ich v nastaveniach.</p>}
        {own && (
          <section className="people-section" aria-label={own.title}>
            <h3>{own.title}</h3>
            <div className="people-list">{own.people.map(personBadge)}</div>
          </section>
        )}
        {/* the other shifts and "Ostatní" are folded away, as on the machine card */}
        {others.length > 0 && (
          <button type="button" className="link-btn" aria-expanded={othersOpen} onClick={() => setOthersOpen(!othersOpen)}>
            {othersOpen ? '▾' : '▸'} Iné zmeny (nadčas) a ostatní
          </button>
        )}
        {!othersOpen && othersOnMachines.length > 0 && (
          <div className="people-list">{othersOnMachines.map(personBadge)}</div>
        )}
        {othersOpen &&
          others.map((g) => (
            <section key={g.shift.id} className="people-section" aria-label={g.title}>
              <h4>{g.title}</h4>
              <div className="people-list">{g.people.map(personBadge)}</div>
            </section>
          ))}
      </div>
    </div>
  );
}

/** One person: tap machines to assign or remove them; set the order type of each assigned machine. */
function PersonPanel({ person, people, shiftId, machines, halls, assignments, onClose }: {
  person: Person;
  /** Everyone, for the names of the people on taken machines. */
  people: Person[];
  shiftId: string;
  machines: Machine[];
  halls: Hall[];
  assignments: Record<string, Assignment>;
  onClose(): void;
}) {
  const db = useDB();
  const mine = machines.filter((m) => assignments[m.id]?.personIds.includes(person.id));
  const zones = halls.length > 1 ? halls : [{ id: '', name: '' } as Hall];
  const [showTaken, setShowTaken] = useState(false);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  /** Machines nobody works on yet, and this person's own (so they can be taken off again). */
  const free = machines.filter((m) => mine.includes(m) || (assignments[m.id]?.personIds.length ?? 0) === 0);
  /** Machines other people work on. */
  const taken = machines.filter((m) => !free.includes(m));
  const machineGroups = (list: Machine[]) =>
    zones.map((z) => {
      const inZone = halls.length > 1 ? list.filter((m) => m.hallId === z.id) : list;
      if (inZone.length === 0) return null;
      return (
        <div key={z.id}>
          {halls.length > 1 && <h4>{z.name}</h4>}
          <div className="people-list">
            {inZone.map((m) => {
              const on = mine.includes(m);
              const others = (assignments[m.id]?.personIds ?? []).filter((id) => id !== person.id).map((id) => nameOf.get(id) ?? '?');
              return (
                <label key={m.id} className={`person ${on ? 'person--on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => togglePerson(db, shiftId, m.id, person.id)} />
                  <span>{m.name}</span>
                  {others.length > 0 && <small className="person__count">{others.join(', ')}</small>}
                </label>
              );
            })}
          </div>
        </div>
      );
    });
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--tall" role="dialog" aria-label={person.name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__top">
          <div className="sheet__head">
            <h2>{person.name} <small className="muted">{ROLE_LABEL[roleOf(person)]}</small></h2>
            <button className="btn" onClick={onClose}>Hotovo</button>
          </div>
        </div>
        <h3>Zakázka na strojoch</h3>
        {mine.length === 0 && <p className="muted">Zatiaľ bez stroja – vyberte ho nižšie.</p>}
        {mine.map((m) => {
          const type = assignments[m.id]?.type ?? null;
          return (
            <div key={m.id} className="row" role="group" aria-label={`Zakázka – ${m.name}`}>
              <strong className="person-machine__name">{m.name}</strong>
              {TYPES.map((t) => (
                <button
                  key={t.label}
                  className={`btn btn--type ${t.cls} ${type === t.value ? 'btn--selected' : ''}`}
                  aria-pressed={type === t.value}
                  onClick={() => setMachineType(db, shiftId, m.id, t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          );
        })}
        <h3>Stroje</h3>
        {/* free machines (and this person's own) first; machines other people work on folded away */}
        {machineGroups(free)}
        {taken.length > 0 && (
          <button type="button" className="link-btn" aria-expanded={showTaken} onClick={() => setShowTaken(!showTaken)}>
            {showTaken ? '▾' : '▸'} Obsadené stroje ({taken.length})
          </button>
        )}
        {showTaken && machineGroups(taken)}
      </div>
    </div>
  );
}
