import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from './useDB';
import { buildShiftRecord } from '../domain/record';
import { multiText, computeStats } from '../domain/stats';
import { saveRecordAndReset } from '../db/repo';
import { formatPct } from '../report/xlsx';
import { APP_UPDATED_MESSAGE, loadExcel } from '../report/excel';
import { ExportMenu } from './ExportMenu';
import type { ShiftRecord, Stats } from '../domain/types';

interface Props {
  shiftId: string;
  onCancel(): void;
  onClosed(): void;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * "Uzavrieť zmenu" saves the record to the history; nothing is exported by itself. Then "Exportovať"
 * offers the files (Excel / PDF) and where they go (report folder, download, share).
 * After closing the dialog renders from local state, so it keeps working although the draft is gone.
 */
export function CloseShiftDialog({ shiftId, onCancel, onClosed }: Props) {
  const db = useDB();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<{ record: ShiftRecord } | null>(null);
  const live = useLiveQuery(async () => {
    const [draft, machines, people] = await Promise.all([
      db.drafts.get(shiftId),
      db.machines.toArray(), // all zones of the department
      db.people.toArray(),
    ]);
    return { draft, machines, people };
  }, [db, shiftId]);

  // Warm up the Excel library while the foreman reads the summary.
  useEffect(() => {
    loadExcel().catch(() => {});
  }, []);

  async function close() {
    setBusy(true);
    setError(null);
    try {
      const [draft, machines, people, shifts, halls] = await Promise.all([
        db.drafts.get(shiftId),
        db.machines.toArray(),
        db.people.toArray(),
        db.shifts.toArray(),
        db.halls.orderBy('order').toArray(),
      ]);
      const shift = shifts.find((s) => s.id === shiftId);
      if (!draft || !shift) throw new Error('Zmena už nie je otvorená');
      const record = buildShiftRecord({ draft, shift, machines, people, shifts, halls, now: new Date(), id: crypto.randomUUID() });
      await saveRecordAndReset(db, record);
      setClosed({ record });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }


  const stats: Stats | null = closed
    ? closed.record.stats
    : live?.draft
      ? computeStats(live.machines, live.draft.assignments, live.people)
      : null;
  if (!stats) return null;

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-label="Uzavrieť zmenu">
        <h2>{closed ? 'Zmena uzavretá' : 'Uzavrieť zmenu'}</h2>
        <p>
          Obsadenosť <strong>{formatPct(stats.staffedPct)}</strong> ({stats.staffed ?? 0} / {stats.total} strojov s ľuďmi) ·
          Frézari {stats.frezari ?? 0} · Operátori {stats.operatori ?? 0} · Viacobsluha{' '}
          {multiText(stats.multiPeople ?? 0, stats.multiMachines)}
          <br />
          <span className="muted">
            Vyťaženie strojov {formatPct(stats.occupancyPct)} ({stats.occupied}) · EXT {stats.ext} ({formatPct(stats.extPct)}) ·
            INT {stats.int} ({formatPct(stats.intPct)})
          </span>
        </p>
        {!closed && stats.peopleWithoutType > 0 && (
          <div className="notice notice--warn">
            {stats.peopleWithoutType === 1
              ? '1 stroj má ľudí bez farby – nebude započítaný medzi zákazky.'
              : `${stats.peopleWithoutType} strojov má ľudí bez farby – nebudú započítané medzi zákazky.`}
          </div>
        )}
        {closed ? (
          <p>Zmena je uzavretá a uložená v histórii. Report (Excel, PDF) uložíte alebo pošlete cez Exportovať.</p>
        ) : (
          <p className="muted">Po uzavretí sa zmena uloží do histórie a pôdorys tejto zmeny sa vyprázdni.</p>
        )}
        {error && (
          <div className="notice notice--warn">
            {error}
            {error === APP_UPDATED_MESSAGE && (
              <button className="btn btn--small" onClick={() => location.reload()}>Obnoviť aplikáciu</button>
            )}
          </div>
        )}
        <div className="row">
          {closed ? (
            <>
              <ExportMenu records={[closed.record]} />
              <button className="btn" disabled={busy} onClick={onClosed}>Hotovo</button>
            </>
          ) : (
            <>
              <button className="btn btn--primary" disabled={busy} onClick={close}>Uzavrieť zmenu</button>
              <button className="btn" disabled={busy} onClick={onCancel}>Späť</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
