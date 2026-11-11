import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from './useDB';
import { continueDraft, getLastForeman, startDraft } from '../db/repo';
import type { ShiftDraft } from '../domain/types';

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtStarted = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ShiftPicker({ onPicked }: { onPicked(shiftId: string): void }) {
  const db = useDB();
  const shifts = useLiveQuery(() => db.shifts.orderBy('order').toArray(), [db]) ?? [];
  const drafts = useLiveQuery(() => db.drafts.toArray(), [db]) ?? [];
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [pending, setPending] = useState<ShiftDraft | null>(null);

  async function choose(id: string) {
    setShiftId(id);
    setName((await getLastForeman(db, id)) ?? '');
  }

  async function proceed() {
    if (!shiftId || !name.trim()) return;
    const existing = await db.drafts.get(shiftId);
    if (existing) setPending(existing);
    else {
      await startDraft(db, shiftId, name.trim(), new Date());
      onPicked(shiftId);
    }
  }

  async function resume(fresh: boolean) {
    if (!shiftId) return;
    if (fresh) await startDraft(db, shiftId, name.trim(), new Date());
    else await continueDraft(db, shiftId, name.trim());
    onPicked(shiftId);
  }

  if (pending) {
    return (
      <div className="center-card">
        <h2>Rozpracované od {fmtStarted(pending.startedAt)}</h2>
        <p className="muted">Majster: {pending.foremanName}</p>
        <div className="row">
          <button className="btn btn--primary" onClick={() => resume(false)}>Pokračovať v rozpracovanej</button>
          <button className="btn" onClick={() => resume(true)}>Začať nanovo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="center-card">
      <h1>Vyber svoju zmenu</h1>
      <div className="row shift-buttons">
        {shifts.map((s) => {
          const hasDraft = drafts.some((d) => d.shiftId === s.id);
          return (
            <button
              key={s.id}
              className={`btn btn--shift ${shiftId === s.id ? 'btn--selected' : ''}`}
              aria-pressed={shiftId === s.id}
              onClick={() => choose(s.id)}
            >
              {s.name}
              {hasDraft && <small> rozpracované</small>}
            </button>
          );
        })}
      </div>
      {shiftId && (
        <>
          <label className="field">
            <span>Meno majstra</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </label>
          <button className="btn btn--primary" disabled={!name.trim()} onClick={proceed}>
            Pokračovať
          </button>
        </>
      )}
    </div>
  );
}
