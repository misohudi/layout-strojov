import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from './useDB';
import { listRecords } from '../db/repo';
import { buildHistoryXlsx, formatPct, skDate } from '../report/xlsx';
import { shareOrDownload } from '../report/share';
import { localDate } from '../domain/record';
import { RecordDetail } from './RecordDetail';

export function HistoryView({ onBack }: { onBack(): void }) {
  const db = useDB();
  const [shiftId, setShiftId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const shifts = useLiveQuery(() => db.shifts.orderBy('order').toArray(), [db]) ?? [];
  const records = useLiveQuery(
    () => listRecords(db, { shiftId: shiftId || undefined, from: from || undefined, to: to || undefined }),
    [db, shiftId, from, to],
  );

  const open = records?.find((r) => r.id === openId);
  if (open) return <RecordDetail record={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="page">
      <div className="page__head">
        <button className="btn" onClick={onBack}>← Späť</button>
        <h2>História zmien</h2>
        <button
          className="btn btn--primary"
          disabled={!records?.length}
          onClick={async () =>
            shareOrDownload(
              await buildHistoryXlsx(records ?? []),
              `Historia_obsadenosti_${localDate(new Date().toISOString())}.xlsx`,
            )
          }
        >
          Exportovať do Excelu
        </button>
      </div>
      <div className="card row">
        <label className="field">
          <span>Zmena</span>
          <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            <option value="">Všetky</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Od</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>Do</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="card table-wrap">
        {records && records.length === 0 ? (
          <p className="muted">Zatiaľ žiadne uzavreté zmeny.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Dátum</th><th>Zmena</th><th>Majster</th><th>Obsadenosť</th><th>EXT</th><th>INT</th>
              </tr>
            </thead>
            <tbody>
              {(records ?? []).map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)}>
                  <td>{skDate(r.date)}</td>
                  <td>{r.shiftName}</td>
                  <td>{r.foremanName}</td>
                  <td>{`${formatPct(r.stats.occupancyPct)} (${r.stats.occupied}/${r.stats.total})`}</td>
                  <td>{`${r.stats.ext} (${formatPct(r.stats.extPct)})`}</td>
                  <td>{`${r.stats.int} (${formatPct(r.stats.intPct)})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
