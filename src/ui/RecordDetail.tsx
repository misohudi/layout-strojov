import { useEffect, useState } from 'react';
import { Floor } from './Floor';
import { MachineTile } from './MachineTile';
import { PLAN_FRAME, cropped } from './grid';
import { hallLayout, isUniform } from '../domain/compact';
import { buildReportXlsx, formatPct, reportFileName, skDate } from '../report/xlsx';
import { shareOrDownload } from '../report/share';
import { buildRecordsPdf, pdfFileName } from '../report/pdf';
import {
  getReportFolder, requestFolderAccess, saveResultMessage, saveToReportFolder, type FolderHandle,
} from '../report/folder';
import { useDB } from './useDB';
import { BackButton } from './icons';
import type { ShiftRecord } from '../domain/types';

/** A closed shift split into its zones (one plan each), with the people per machine. */
export function recordZones(record: ShiftRecord) {
  // Records closed with machines of different sizes are shown with equally sized cells like the plan.
  const layout = isUniform(record.layout) ? record.layout : hallLayout(record.layout);
  const peopleByMachine = new Map(record.rows.map((r) => [r.machineName, r.people]));
  // one plan per zone (older records: one plan)
  const zones: { id: string; name: string; items: typeof layout }[] = [];
  for (const l of layout) {
    const id = l.hallId ?? '';
    let z = zones.find((x) => x.id === id);
    if (!z) zones.push((z = { id, name: l.hallName ?? '', items: [] }));
    z.items.push(l);
  }
  const withZones = zones.length > 1 || record.rows.some((r) => r.hallName);
  return { zones, peopleByMachine, withZones };
}

/** The plan of one zone of a closed shift, as in the history. */
export function RecordZonePlan({ items, peopleByMachine }: {
  items: ShiftRecord['layout'];
  peopleByMachine: Map<string, ShiftRecord['rows'][number]['people']>;
}) {
  const shown = cropped(items);
  return (
    <Floor items={shown} frame={PLAN_FRAME} fill>
      {shown.map((l) => (
        <MachineTile key={l.name} {...l} people={peopleByMachine.get(l.name) ?? []} />
      ))}
    </Floor>
  );
}

export function RecordDetail({ record, onBack }: { record: ShiftRecord; onBack(): void }) {
  const s = record.stats;
  // Prepare the file up front so the share sheet opens directly inside the tap (required on iPad).
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const db = useDB();
  const [folder, setFolder] = useState<FolderHandle | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
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
  const { zones, peopleByMachine, withZones } = recordZones(record);
  return (
    <div className="page">
      <div className="page__head">
        <BackButton onClick={onBack} />
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
        <button
          className="btn btn--primary"
          disabled={pdfBusy}
          onClick={async () => {
            setPdfBusy(true);
            setError(null);
            try {
              await shareOrDownload(await buildRecordsPdf([record]), pdfFileName([record]));
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setPdfBusy(false);
            }
          }}
        >
          {pdfBusy ? 'Pripravujem PDF…' : 'Zdieľať PDF'}
        </button>
        </div>
      </div>
      {savedTo && <div className="notice notice--ok">{savedTo}</div>}
      {error && <div className="notice notice--warn">{error}</div>}
      <div className="card">
        Majster: <strong>{record.foremanName}</strong>
        {s.staffed != null && (
          <>
            {' '}· Obsadenosť <strong>{formatPct(s.staffedPct)}</strong> ({s.staffed} / {s.total}) · Frézari{' '}
            {s.frezari ?? 0} · Operátori {s.operatori ?? 0}
            {s.multiPeople != null && ` · Viacobsluha ${s.multiPeople} ľ / ${s.multiMachines ?? 0} str`}
          </>
        )}
        {' '}· Vyťaženie strojov {formatPct(s.occupancyPct)} ({s.occupied} / {s.total}) · EXT {s.ext} ({formatPct(s.extPct)}) · INT{' '}
        {s.int} ({formatPct(s.intPct)})
      </div>
      {zones.map((z) => (
        <section key={z.id} className="record-zone" aria-label={z.name || undefined}>
          {zones.length > 1 && <h3 className="record-zone__name">{z.name}</h3>}
          <RecordZonePlan items={z.items} peopleByMachine={peopleByMachine} />
        </section>
      ))}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Stroj</th>{withZones && <th>Oddelenie</th>}<th>Zakázka</th><th>Priorita</th><th>Ľudia</th></tr>
          </thead>
          <tbody>
            {record.rows.map((r) => (
              <tr key={r.machineName}>
                <td>{r.machineName}</td>
                {withZones && <td>{r.hallName ?? ''}</td>}
                <td>{r.outOfService ? 'mimo prevádzky' : (r.type ?? '–')}</td>
                <td>{r.priority ? <span className="prio-badge prio-badge--inline">PRIO</span> : ''}</td>
                <td>{r.people.map((p) => (p.overtime ? `${p.name} (${p.homeShiftName})` : p.name)).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
