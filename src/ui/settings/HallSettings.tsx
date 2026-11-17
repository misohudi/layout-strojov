import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from '../useDB';
import { addHall, deleteHall, moveHall, renameHall } from '../../db/repo';
import type { Hall } from '../../domain/types';

function HallRow({ h, machines, last, first, final }: { h: Hall; machines: number; last: boolean; first: boolean; final: boolean }) {
  const db = useDB();
  const [name, setName] = useState(h.name);
  const canDelete = machines === 0 && !last;
  return (
    <li className="hall-row">
      <span className="hall-row__move">
        <button className="btn btn--small" aria-label={`Posunúť ${h.name} hore`} title="Hore" disabled={first} onClick={() => moveHall(db, h.id, -1)}>↑</button>
        <button className="btn btn--small" aria-label={`Posunúť ${h.name} dole`} title="Dole" disabled={final} onClick={() => moveHall(db, h.id, 1)}>↓</button>
      </span>
      <input aria-label={`Názov oddelenia ${h.name}`} value={name} onChange={(e) => setName(e.target.value)} />
      <span className="muted">{`${machines} ${machines === 1 ? 'stroj' : machines >= 2 && machines <= 4 ? 'stroje' : 'strojov'}`}</span>
      <button
        className="btn btn--small"
        disabled={!name.trim() || name.trim() === h.name}
        onClick={() => renameHall(db, h, name.trim())}
      >
        Uložiť
      </button>
      <button
        className="btn btn--small btn--danger"
        aria-label={`Odstrániť oddelenie ${h.name}`}
        title={canDelete ? undefined : 'Odstrániť sa dá len prázdne oddelenie (stroje presuňte alebo odstráňte v záložke Stroje).'}
        disabled={!canDelete}
        onClick={() => window.confirm(`Odstrániť oddelenie ${h.name}?`) && deleteHall(db, h.id)}
      >
        Odstrániť
      </button>
    </li>
  );
}

/** Zones (workplaces) of the department – each has its own plan on the main screen. */
export function HallSettings() {
  const db = useDB();
  const halls = useLiveQuery(() => db.halls.orderBy('order').toArray(), [db]) ?? [];
  const machines = useLiveQuery(() => db.machines.toArray(), [db]) ?? [];
  const [name, setName] = useState('');
  const count = (id: string) => machines.filter((m) => m.hallId === id).length;

  return (
    <div className="card stack">
      <p className="muted">
        Pracoviská oddelenia. Na hlavnej obrazovke sa medzi nimi prepína potiahnutím prstom alebo šípkami po stranách. Stroje
        oddelenia upravíte v záložke Stroje.
      </p>
      <ul className="plain-list">
        {halls.map((h, i) => (
          <HallRow key={h.id} h={h} machines={count(h.id)} last={halls.length === 1} first={i === 0} final={i === halls.length - 1} />
        ))}
      </ul>
      <div className="row row--bottom">
        <label className="field">
          <span>Nové oddelenie</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          className="btn btn--primary"
          disabled={!name.trim()}
          onClick={async () => {
            await addHall(db, name.trim());
            setName('');
          }}
        >
          Pridať oddelenie
        </button>
      </div>
    </div>
  );
}
