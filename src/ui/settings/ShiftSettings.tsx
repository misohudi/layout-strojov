import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from '../useDB';
import { deleteShift, upsertShift } from '../../db/repo';
import type { Shift } from '../../domain/types';

function ShiftRow({ s, onError }: { s: Shift; onError(msg: string | null): void }) {
  const db = useDB();
  const [name, setName] = useState(s.name);
  return (
    <li className="row person-row">
      <input aria-label={`Názov zmeny ${s.name}`} value={name} onChange={(e) => setName(e.target.value)} />
      <button
        className="btn btn--small"
        disabled={!name.trim() || name.trim() === s.name}
        onClick={() => upsertShift(db, { ...s, name: name.trim() })}
      >
        Uložiť
      </button>
      <button
        className="btn btn--small btn--danger"
        aria-label={`Odstrániť zmenu ${s.name}`}
        onClick={async () => {
          onError(null);
          if (!window.confirm(`Odstrániť zmenu ${s.name}?`)) return;
          try {
            await deleteShift(db, s.id);
          } catch (e) {
            onError(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        Odstrániť
      </button>
    </li>
  );
}

export function ShiftSettings() {
  const db = useDB();
  const shifts = useLiveQuery(() => db.shifts.orderBy('order').toArray(), [db]) ?? [];
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  return (
    <div className="card stack">
      {error && <div className="notice notice--warn">{error}</div>}
      <ul className="plain-list">
        {shifts.map((s) => <ShiftRow key={s.id} s={s} onError={setError} />)}
      </ul>
      <div className="row">
        <label className="field">
          <span>Nová zmena</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          className="btn btn--primary"
          disabled={!name.trim()}
          onClick={async () => {
            await upsertShift(db, { name: name.trim(), order: Math.max(-1, ...shifts.map((s) => s.order)) + 1 });
            setName('');
          }}
        >
          Pridať zmenu
        </button>
      </div>
    </div>
  );
}
