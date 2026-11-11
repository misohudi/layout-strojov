import { useState } from 'react';
import { useDB } from './useDB';
import { buildShiftRecord } from '../domain/record';
import { computeStats } from '../domain/stats';
import { saveRecordAndReset } from '../db/repo';
import { buildReportXlsx, formatPct, reportFileName } from '../report/xlsx';
import { shareOrDownload } from '../report/share';
import { useLiveQuery } from 'dexie-react-hooks';
import { HALL_FREZY } from '../domain/seed';

interface Props {
  shiftId: string;
  onCancel(): void;
  onClosed(): void;
}

export function CloseShiftDialog({ shiftId, onCancel, onClosed }: Props) {
  const db = useDB();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const [draft, machines] = await Promise.all([
      db.drafts.get(shiftId),
      db.machines.where('hallId').equals(HALL_FREZY).toArray(),
    ]);
    return { draft, machines };
  }, [db, shiftId]);

  if (!data?.draft) return null;
  const stats = computeStats(data.machines, data.draft.assignments);

  async function close() {
    setBusy(true);
    setError(null);
    try {
      const [draft, machines, people, shifts] = await Promise.all([
        db.drafts.get(shiftId),
        db.machines.where('hallId').equals(HALL_FREZY).toArray(),
        db.people.toArray(),
        db.shifts.toArray(),
      ]);
      const shift = shifts.find((s) => s.id === shiftId);
      if (!draft || !shift) throw new Error('Zmena už nie je otvorená');
      const record = buildShiftRecord({ draft, shift, machines, people, shifts, now: new Date(), id: crypto.randomUUID() });
      await saveRecordAndReset(db, record);
      // The record is saved first; sharing may be cancelled without losing it.
      await shareOrDownload(await buildReportXlsx(record), reportFileName(record));
      onClosed();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-label="Uzavrieť zmenu">
        <h2>Uzavrieť zmenu</h2>
        <p>
          Obsadenosť <strong>{formatPct(stats.occupancyPct)}</strong> ({stats.occupied} / {stats.total} strojov) ·
          EXT {stats.ext} ({formatPct(stats.extPct)}) · INT {stats.int} ({formatPct(stats.intPct)})
        </p>
        {stats.peopleWithoutType > 0 && (
          <div className="notice notice--warn">
            {stats.peopleWithoutType === 1
              ? '1 stroj má ľudí bez farby – nebude započítaný ako obsadený.'
              : `${stats.peopleWithoutType} strojov má ľudí bez farby – nebudú započítané ako obsadené.`}
          </div>
        )}
        <p className="muted">Po uzavretí sa zmena uloží do histórie a pôdorys tejto zmeny sa vyprázdni.</p>
        {error && <div className="notice notice--warn">{error}</div>}
        <div className="row">
          <button className="btn btn--primary" disabled={busy} onClick={close}>Uzavrieť a zdieľať</button>
          <button className="btn" disabled={busy} onClick={onCancel}>Späť</button>
        </div>
      </div>
    </div>
  );
}
