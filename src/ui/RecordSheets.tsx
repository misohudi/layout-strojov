import { recordZones, RecordZonePlan, StaffingKpi, statsLine } from './RecordDetail';

export { statsLine };
import { MpsLogo } from './Brand';
import { cropped } from './grid';
import { skDate } from '../report/xlsx';
import type { ShiftRecord } from '../domain/types';

/** A4 landscape at 96 dpi: the size of one PDF page as it is drawn before it becomes an image. */
export const PAGE_W = 1123;
export const PAGE_H = 794;
/**
 * Machines per table page (the rest continues on the next page). Rows have a fixed height (long lists
 * of people end in "…"), so this many always fit under the header – none is cut off at the bottom.
 */
export const ROWS_PER_PAGE = 22;

/** Splits the machine rows into pages of the table. */
export function chunkRows<T>(rows: T[], size = ROWS_PER_PAGE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += size) pages.push(rows.slice(i, i + size));
  return pages.length ? pages : [[]];
}

/** Rows of a zone's plan as drawn (cropped to its machines). */
const zoneRows = (items: ShiftRecord['layout']) => Math.max(1, ...cropped(items).map((l) => l.y + l.h));

function PageHead({ record, sub }: { record: ShiftRecord; sub?: string }) {
  return (
    <header className="pdf-page__head">
      <div className="pdf-page__headline">
        <h1 className="pdf-page__title">{`Zmena ${record.shiftName} · ${skDate(record.date)}${sub ? ` · ${sub}` : ''}`}</h1>
        <p className="pdf-page__stats">{statsLine(record)}</p>
      </div>
      <StaffingKpi record={record} />
      <MpsLogo className="pdf-page__logo" still />
    </header>
  );
}

/**
 * The pages of one closed shift for the PDF: the plan of every zone exactly as in the history, then
 * the table of machines and people. Drawn off-screen and turned into page images.
 */
export function RecordSheets({ record }: { record: ShiftRecord }) {
  const { zones, peopleByMachine, withZones } = recordZones(record);
  const tables = chunkRows(record.rows);
  return (
    <>
      <section className="pdf-page" style={{ width: PAGE_W, height: PAGE_H }}>
        <PageHead record={record} />
        <div className="pdf-page__plans">
          {zones.map((z) => (
            // a zone gets room by its number of rows (Frézovňa 6, HSC 2) plus a row for its name
            <div key={z.id} className="pdf-page__zone" style={{ flexGrow: zoneRows(z.items) + 1 }}>
              {zones.length > 1 && <h2 className="pdf-page__zone-name">{z.name}</h2>}
              <RecordZonePlan items={z.items} peopleByMachine={peopleByMachine} />
            </div>
          ))}
        </div>
      </section>
      {tables.map((rows, i) => (
        <section key={i} className="pdf-page" style={{ width: PAGE_W, height: PAGE_H }}>
          <PageHead record={record} sub={tables.length > 1 ? `stroje ${i + 1}/${tables.length}` : 'stroje'} />
          <table className="pdf-page__table">
            <thead>
              <tr><th>Stroj</th>{withZones && <th>Oddelenie</th>}<th>Zakázka</th><th>Priorita</th><th>Ľudia</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
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
        </section>
      ))}
    </>
  );
}
