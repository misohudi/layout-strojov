import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from './useDB';
import { buildShiftRecord } from '../domain/record';
import { computeStats } from '../domain/stats';
import { saveRecordAndReset } from '../db/repo';
import { buildReportXlsx, formatPct, reportFileName } from '../report/xlsx';
import { loadExcel } from '../report/excel';
import { shareOrDownload } from '../report/share';
import { HALL_FREZY } from '../domain/seed';
import type { ShiftRecord, Stats } from '../domain/types';

interface Props {
  shiftId: string;
  onCancel(): void;
  onClosed(): void;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Two steps on purpose:
 * 1. "Uzavrieť zmenu" saves the record and prepares the Excel file.
 * 2. "Zdieľať report" is a separate tap that calls the share sheet right away – browsers
 *    (especially Safari on iPad) only allow sharing directly inside a user gesture.
 * After step 1 the dialog renders from local state, so it keeps working although the draft is gone.
 */
export function CloseShiftDialog({ shiftId, onCancel, onClosed }: Props) {
  const db = useDB();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<{ record: ShiftRecord; blob: Blob | null } | null>(null);
  const [shared, setShared] = useState(false);
  const live = useLiveQuery(async () => {
    const [draft, machines] = await Promise.all([
      db.drafts.get(shiftId),
      db.machines.where('hallId').equals(HALL_FREZY).toArray(),
    ]);
    return { draft, machines };
  }, [db, shiftId]);

  // Warm up the Excel library while the foreman reads the summary.
  useEffect(() => {
    loadExcel().catch(() => {});
  }, []);

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
      setClosed({ record, blob: null });
      try {
        setClosed({ record, blob: await buildReportXlsx(record) });
      } catch (e) {
        setError(errMsg(e));
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!closed) return;
    setError(null);
    setBusy(true);
    try {
      // The blob is normally ready, so share() runs immediately inside this tap.
      const blob = closed.blob ?? (await buildReportXlsx(closed.record));
      if (!closed.blob) setClosed({ ...closed, blob });
      const res = await shareOrDownload(blob, reportFileName(closed.record));
      if (res !== 'cancelled') setShared(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const stats: Stats | null = closed
    ? closed.record.stats
    : live?.draft
      ? computeStats(live.machines, live.draft.assignments)
      : null;
  if (!stats) return null;

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-label="Uzavrieť zmenu">
        <h2>{closed ? 'Zmena uzavretá' : 'Uzavrieť zmenu'}</h2>
        <p>
          Obsadenosť <strong>{formatPct(stats.occupancyPct)}</strong> ({stats.occupied} / {stats.total} strojov) ·
          EXT {stats.ext} ({formatPct(stats.extPct)}) · INT {stats.int} ({formatPct(stats.intPct)})
        </p>
        {!closed && stats.peopleWithoutType > 0 && (
          <div className="notice notice--warn">
            {stats.peopleWithoutType === 1
              ? '1 stroj má ľudí bez farby – nebude započítaný ako obsadený.'
              : `${stats.peopleWithoutType} strojov má ľudí bez farby – nebudú započítané ako obsadené.`}
          </div>
        )}
        {closed ? (
          <p>
            Zmena je uzavretá a uložená v histórii.
            {shared && <span className="muted"> Report bol odoslaný.</span>}
          </p>
        ) : (
          <p className="muted">Po uzavretí sa zmena uloží do histórie a pôdorys tejto zmeny sa vyprázdni.</p>
        )}
        {error && (
          <div className="notice notice--warn">
            {error}
            {closed && <button className="btn btn--small" onClick={() => location.reload()}>Obnoviť aplikáciu</button>}
          </div>
        )}
        <div className="row">
          {closed ? (
            <>
              <button className="btn btn--primary" disabled={busy} onClick={share}>Zdieľať report</button>
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
