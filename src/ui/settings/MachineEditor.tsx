import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from '../useDB';
import { Floor } from '../Floor';
import { MachineTile } from '../MachineTile';
import { deleteMachine, upsertMachine } from '../../db/repo';
import { freeSpotBelow, moveMachine, resizeMachine } from '../../domain/layoutEdit';
import { HALL_FREZY } from '../../domain/seed';
import type { Machine } from '../../domain/types';

export function MachineEditor() {
  const db = useDB();
  const machines = useLiveQuery(() => db.machines.where('hallId').equals(HALL_FREZY).toArray(), [db]) ?? [];
  const [selId, setSelId] = useState<string | null>(null);
  const sel = machines.find((m) => m.id === selId);
  const [name, setName] = useState('');

  useEffect(() => setName(sel?.name ?? ''), [sel?.id, sel?.name]);

  const save = (m: Machine) => upsertMachine(db, m);

  async function add() {
    const pos = freeSpotBelow(machines);
    const id = await upsertMachine(db, { hallId: HALL_FREZY, name: 'Nový stroj', ...pos, w: 2, h: 2, status: 'active' });
    setSelId(id);
  }

  async function remove() {
    if (!sel) return;
    if (!window.confirm(`Odstrániť stroj „${sel.name}“? Radšej zvážte ‚mimo prevádzky‘ – odstránenie nevráti späť.`)) return;
    await deleteMachine(db, sel.id);
    setSelId(null);
  }

  return (
    <div className="editor">
      <div className="card editor__tools">
        {!sel ? (
          <p className="muted">Ťuknite na stroj v pôdoryse, ktorý chcete upraviť.</p>
        ) : (
          <>
            <div className="row">
              <label className="field">
                <span>Názov stroja</span>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <button className="btn" disabled={!name.trim() || name.trim() === sel.name} onClick={() => save({ ...sel, name: name.trim() })}>
                Uložiť názov
              </button>
            </div>
            <div className="row">
              <span className="muted">Posun:</span>
              <button className="btn" aria-label="Posunúť doľava" onClick={() => save(moveMachine(sel, -1, 0))}>←</button>
              <button className="btn" aria-label="Posunúť hore" onClick={() => save(moveMachine(sel, 0, -1))}>↑</button>
              <button className="btn" aria-label="Posunúť dole" onClick={() => save(moveMachine(sel, 0, 1))}>↓</button>
              <button className="btn" aria-label="Posunúť doprava" onClick={() => save(moveMachine(sel, 1, 0))}>→</button>
              <span className="muted">Veľkosť:</span>
              <button className="btn" onClick={() => save(resizeMachine(sel, 1, 0))}>Širší</button>
              <button className="btn" onClick={() => save(resizeMachine(sel, -1, 0))}>Užší</button>
              <button className="btn" onClick={() => save(resizeMachine(sel, 0, 1))}>Vyšší</button>
              <button className="btn" onClick={() => save(resizeMachine(sel, 0, -1))}>Nižší</button>
            </div>
            <div className="row">
              {sel.status === 'active' ? (
                <button className="btn" onClick={() => save({ ...sel, status: 'out_of_service' })}>Mimo prevádzky</button>
              ) : (
                <button className="btn" onClick={() => save({ ...sel, status: 'active' })}>Vrátiť do prevádzky</button>
              )}
              <button className="btn btn--danger" onClick={remove}>Odstrániť stroj</button>
            </div>
          </>
        )}
        <div className="row">
          <button className="btn btn--primary" onClick={add}>Pridať stroj</button>
        </div>
      </div>
      <Floor items={machines}>
        {machines.map((m) => (
          <MachineTile
            key={m.id}
            {...m}
            type={null}
            outOfService={m.status !== 'active'}
            selected={m.id === selId}
            onClick={() => setSelId(m.id)}
          />
        ))}
      </Floor>
    </div>
  );
}
