import { useEffect, useState } from 'react';
import { Floor } from './Floor';
import { MachineTile } from './MachineTile';
import { PLAN_FRAME, cropped } from './grid';
import { hallLayout, isUniform } from '../domain/compact';
import { buildReportXlsx, formatPct, reportFileName, skDate } from '../report/xlsx';
import { downloadBlob, shareOrDownload } from '../report/share';
import { pdfFileName } from '../report/pdf';
import { ExportMenu, usePdf } from './ExportMenu';
import {
  getReportFolder, requestFolderAccess, saveResultMessage, saveToReportFolder, type FolderHandle,
} from '../report/folder';
import { useDB } from './useDB';
import { BackButton } from './icons';
import type { ShiftRecord } from '../domain/types';
import { multiText } from '../domain/stats';

/** The other figures of the shift next to the occupancy (the foreman is the shift's name in the title). */
export function statsLine(record: ShiftRecord) {
  const s = record.stats;
  const parts: string[] = [];
  if (s.staffed != null) {
    parts.push(`Frézari ${s.frezari ?? 0} · Operátori ${s.operatori ?? 0}`);
    parts.push(`Viacobsluha ${multiText(s.multiPeople, s.multiMachines)}`);
  }
  parts.push(`Vyťaženie strojov ${formatPct(s.occupancyPct)} (${s.occupied} / ${s.total})`);
  parts.push(`EXT ${s.ext} (${formatPct(s.extPct)}) · INT ${s.int} (${formatPct(s.intPct)})`);
  return parts.join(' · ');
}

/** The figure that matters most – occupancy by people – as a large turquoise box (preview and PDF). */
export function StaffingKpi({ record }: { record: ShiftRecord }) {
  const s = record.stats;
  return (
    <div className="pdf-kpi" role="group" aria-label={`Obsadenosť ${formatPct(s.staffedPct ?? null)}`}>
      <span className="pdf-kpi__label">Obsadenosť</span>
      <strong className="pdf-kpi__value">{formatPct(s.staffedPct ?? null)}</strong>
      <small className="pdf-kpi__sub">{s.staffed != null ? `${s.staffed} / ${s.total} strojov s ľuďmi` : 'nezaznamenaná'}</small>
    </div>
  );
}

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
  // Prepare the file up front so the share sheet opens directly inside the tap (required on iPad).
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const db = useDB();
  const [folder, setFolder] = useState<FolderHandle | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const pdf = usePdf([record]);
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
        <ExportMenu
          groups={[
            {
              title: 'PDF – plán a tabuľka',
              actions: [
                { label: 'Stiahnuť PDF', run: async () => downloadBlob(await pdf(), pdfFileName([record])) },
                { label: 'Zdieľať PDF', run: async () => shareOrDownload(await pdf(), pdfFileName([record])) },
              ],
            },
            {
              title: 'Excel – report zmeny',
              // the file is made up front, so sharing opens right inside the tap (needed on iPad)
              note: blob ? undefined : 'Pripravujem report…',
              actions: [
                { label: 'Stiahnuť Excel', disabled: !blob, run: () => blob && downloadBlob(blob, reportFileName(record)) },
                { label: 'Zdieľať Excel', disabled: !blob, run: () => blob && shareOrDownload(blob, reportFileName(record)) },
                ...(folder ? [{ label: 'Uložiť do priečinka', disabled: !blob, run: saveToFolder }] : []),
              ],
            },
          ]}
        />
      </div>
      {savedTo && <div className="notice notice--ok">{savedTo}</div>}
      {error && <div className="notice notice--warn">{error}</div>}
      {/* as in the PDF: occupancy stands out, the other figures next to it */}
      <div className="card record-summary">
        <StaffingKpi record={record} />
        <p className="record-summary__stats">{statsLine(record)}</p>
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
