import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from './useDB';
import { startDraft } from '../db/repo';
import { isPool, type Shift } from '../domain/types';
import { MpsLogo, MuehlbauerLogo } from './Brand';
import { AppButtons } from './Header';

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtStarted = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface Props {
  onPicked(shiftId: string): void;
  onSettings(): void;
  onHistory(): void;
}

/** Start screen: one tap on a shift (named after its foreman) opens it. */
export function ShiftPicker({ onPicked, onSettings, onHistory }: Props) {
  const db = useDB();
  const shifts = (useLiveQuery(() => db.shifts.orderBy('order').toArray(), [db]) ?? []).filter((s) => !isPool(s));
  const drafts = useLiveQuery(() => db.drafts.toArray(), [db]) ?? [];
  const [busy, setBusy] = useState(false);

  async function open(s: Shift) {
    if (busy) return;
    setBusy(true);
    try {
      // An open (not yet closed) shift simply continues; otherwise a new one starts.
      if (!(await db.drafts.get(s.id))) await startDraft(db, s.id, s.name, new Date());
      onPicked(s.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="start">
      {/* the same app buttons as in the plan's header, in the top-right corner */}
      <div className="hgroup start__actions">
        <AppButtons onHistory={onHistory} onSettings={onSettings} />
      </div>
      <div className="center-card">
        <div className="start__logos">
          <MuehlbauerLogo className="start__mb" />
          <MpsLogo className="start__mps" />
        </div>
        <h1>Vyber svoju zmenu</h1>
        <div className="row shift-buttons">
          {shifts.map((s) => {
            const draft = drafts.find((d) => d.shiftId === s.id);
            return (
              <button key={s.id} className="btn btn--shift" disabled={busy} onClick={() => open(s)}>
                {s.name}
                {draft && <small> rozpracované od {fmtStarted(draft.startedAt)}</small>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
