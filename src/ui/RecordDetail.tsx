import { useEffect, useState } from 'react';
import { Floor } from './Floor';
import { MachineTile } from './MachineTile';
import { buildReportXlsx, formatPct, reportFileName, skDate } from '../report/xlsx';
import { shareOrDownload } from '../report/share';
import {
  getReportFolder, requestFolderAccess, saveResultMessage, saveToReportFolder, type FolderHandle,
} from '../report/folder';
import { useDB } from './useDB';
import type { ShiftRecord } from '../domain/types';

export function RecordDetail({ record, onBack }: { record: ShiftRecord; onBack(): void }) {
  const s = record.stats;
  // Prepare the file up front so the share sheet opens directly inside the tap (required on iPad).
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const db = useDB();
  const [folder, setFolder] = useState<FolderHandle | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  useEffect(() => {
    getReportFolder(db).then((h) => setFolder(h ?? null));
  }, [db]);

  async function saveToFolder() {
    if (!folder || !blob) return;
    setError(null);
    setSavedTo(null);
    await requestFolderAccess(folder); // first, while it still counts as the user's tap
    const res = await saveToReportFolder(db, blob, reportFileName(record));
    if (res.ok) setSavedTo(saveResultMessage(res));
    else setError(saveResultMessage(res));
  }

  useEffect(() => {
    let alive = true;
    buildReportXlsx(record).then(
      (b) => alive && setBlob(b),
      (e) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [record]);
  const peopleByMachine = new Map(record.rows.map((r) => [r.machineName, r.people.map((p) => p.name)]));
  return (
    <div className="page">
      <div className="page__head">
        <button className="btn" onClick={onBack}>← Späť</button>
        <h2>{`Zmena ${record.shiftName} · ${skDate(record.date)}`}</h2>
        <div className="row">
        {folder && (
          <button className="btn btn--primary" disabled={!blob} onClick={saveToFolder}>
            Uložiť do priečinka
          </button>
        )}
        <button
          className="btn btn--primary"
          disabled={!blob}
          onClick={() =>
            blob && shareOrDownload(blob, reportFileName(record)).catch((e) => setError(String(e?.message ?? e)))
          }
        >
          Zdieľať report
        </button>
        </div>
      </div>
      {savedTo && <div className="notice notice--ok">{savedTo}</div>}
      {error && <div className="notice notice--warn">{error}</div>}
      <div className="card">
        Majster: <strong>{record.foremanName}</strong> · Obsadenosť <strong>{formatPct(s.occupancyPct)}</strong> (
        {s.occupied} / {s.total}) · EXT {s.ext} ({formatPct(s.extPct)}) · INT {s.int} ({formatPct(s.intPct)})
      </div>
      {record.layout.length > 0 && (
        <Floor items={record.layout}>
          {record.layout.map((l) => (
            <MachineTile key={l.name} {...l} people={peopleByMachine.get(l.name) ?? []} />
          ))}
        </Floor>
      )}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Stroj</th><th>Zakázka</th><th>Ľudia</th></tr>
          </thead>
          <tbody>
            {record.rows.map((r) => (
              <tr key={r.machineName}>
                <td>{r.machineName}</td>
                <td>{r.outOfService ? 'mimo prevádzky' : (r.type ?? '–')}</td>
                <td>{r.people.map((p) => (p.overtime ? `${p.name} (${p.homeShiftName})` : p.name)).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
