import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from '../useDB';
import { Floor } from '../Floor';
import { MachineTile } from '../MachineTile';
import { cellIndex, trackWeights } from '../grid';
import { deleteMachine, upsertMachine } from '../../db/repo';
import { freeSpotBelow, moveMachine } from '../../domain/layoutEdit';
import { packRows } from '../../domain/compact';
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

  /** Moves a machine and packs the rows again, so machines always stand side by side. */
  async function place(m: Machine, x: number, y: number) {
    // same row: ← / → swap with the neighbour; another row: the machine takes the cell it was moved to
    const dx = y === m.y ? Math.sign(x - m.x) : 0;
    const next = packRows(machines.map((o) => (o.id === m.id ? { ...o, x, y } : o)), { id: m.id, dx });
    await db.machines.bulkPut(next);
  }
  const step = (m: Machine, dx: number, dy: number) => {
    const t = moveMachine(m, dx, dy);
    return place(m, t.x, t.y);
  };

  // ---- dragging the selected machine with a finger (or mouse) ----
  interface Drag {
    pointerId: number;
    machine: Machine;
    startCol: number;
    startRow: number;
    /** Grid geometry frozen at drag start, so tracks don't shift under the finger. */
    rect: DOMRect;
    cols: number[];
    rows: number[];
    colGap: number;
    rowGap: number;
    /** Where the machine would land, updated while the finger moves. */
    target: { x: number; y: number };
  }
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null);

  function cellAt(d: Drag, clientX: number, clientY: number) {
    return {
      col: cellIndex(clientX - d.rect.left, d.cols, d.rect.width, d.colGap),
      row: cellIndex(clientY - d.rect.top, d.rows, d.rect.height, d.rowGap),
    };
  }

  function onPointerDown(m: Machine, e: PointerEvent<HTMLButtonElement>) {
    if (m.id !== selId) return; // only the selected machine moves; others just get selected on tap
    const grid = e.currentTarget.parentElement;
    if (!grid) return;
    const css = getComputedStyle(grid);
    const { cols, rows } = trackWeights(machines);
    // tracks start inside the grid's padding
    const r = grid.getBoundingClientRect();
    const pad = (v: string) => parseFloat(v) || 0;
    const [pl, pr, pt, pb] = [css.paddingLeft, css.paddingRight, css.paddingTop, css.paddingBottom].map(pad);
    const rect = new DOMRect(r.left + pl, r.top + pt, r.width - pl - pr, r.height - pt - pb);
    const d: Drag = {
      pointerId: e.pointerId, machine: m, startCol: 0, startRow: 0, rect,
      cols, rows, colGap: parseFloat(css.columnGap) || 0, rowGap: parseFloat(css.rowGap) || 0,
      target: { x: m.x, y: m.y },
    };
    const start = cellAt(d, e.clientX, e.clientY);
    d.startCol = start.col;
    d.startRow = start.row;
    drag.current = d;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const c = cellAt(d, e.clientX, e.clientY);
    const moved = moveMachine(d.machine, c.col - d.startCol, c.row - d.startRow);
    d.target = { x: moved.x, y: moved.y };
    setPreview((p) => (p && p.x === moved.x && p.y === moved.y ? p : { id: moved.id, x: moved.x, y: moved.y }));
  }

  async function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    const { x, y } = d.target;
    if (x !== d.machine.x || y !== d.machine.y) await place(d.machine, x, y);
    setPreview(null);
  }

  function onPointerCancel() {
    drag.current = null;
    setPreview(null);
  }

  async function add() {
    const pos = freeSpotBelow(machines);
    const id = await upsertMachine(db, { hallId: HALL_FREZY, name: 'Nový stroj', ...pos, w: 1, h: 1, status: 'active' });
    await db.machines.bulkPut(packRows(await db.machines.where('hallId').equals(HALL_FREZY).toArray()));
    setSelId(id);
  }

  async function remove() {
    if (!sel) return;
    if (!window.confirm(`Odstrániť stroj „${sel.name}“? Radšej zvážte ‚mimo prevádzky‘ – odstránenie nevráti späť.`)) return;
    await deleteMachine(db, sel.id);
    await db.machines.bulkPut(packRows(await db.machines.where('hallId').equals(HALL_FREZY).toArray()));
    setSelId(null);
  }

  return (
    <div className="editor">
      <div className="card editor__tools">
        {!sel ? (
          <p className="muted">Ťuknite na stroj v pôdoryse, ktorý chcete upraviť. Vybraný stroj potom posuniete ťahaním prstom alebo šípkami.</p>
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
              <button className="btn" aria-label="Posunúť doľava" onClick={() => step(sel, -1, 0)}>←</button>
              <button className="btn" aria-label="Posunúť hore" onClick={() => step(sel, 0, -1)}>↑</button>
              <button className="btn" aria-label="Posunúť dole" onClick={() => step(sel, 0, 1)}>↓</button>
              <button className="btn" aria-label="Posunúť doprava" onClick={() => step(sel, 1, 0)}>→</button>
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
        {machines.map((m) => {
          const p = preview?.id === m.id ? preview : null;
          return (
            <MachineTile
              key={m.id}
              {...m}
              x={p ? p.x : m.x}
              y={p ? p.y : m.y}
              type={null}
              outOfService={m.status !== 'active'}
              selected={m.id === selId}
              dragging={!!p}
              onClick={() => setSelId(m.id)}
              dragProps={
                m.id === selId
                  ? {
                      onPointerDown: (e) => onPointerDown(m, e),
                      onPointerMove,
                      onPointerUp,
                      onPointerCancel,
                    }
                  : undefined
              }
            />
          );
        })}
      </Floor>
    </div>
  );
}
