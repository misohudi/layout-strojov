import type ExcelJS from 'exceljs';
import { loadExcel } from './excel';
import type { RecordRow, ShiftRecord } from '../domain/types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FILL = { EXT: 'FF93C5FD', INT: 'FFFCA5A5' } as const;

/** "2,9 %" – one decimal with a Slovak decimal comma; "–" when there is nothing to divide by. */
export function formatPct(v: number | null): string {
  return v === null ? '–' : `${v.toFixed(1).replace('.', ',')} %`;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const skDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function reportFileName(r: ShiftRecord): string {
  return `Obsadenost_Frezy_${r.date}_zmena-${r.shiftName}.xlsx`;
}

const typeLabel = (row: RecordRow) => (row.outOfService ? 'mimo prevádzky' : (row.type ?? '–'));
const peopleLabel = (row: RecordRow) =>
  row.people.map((p) => (p.overtime ? `${p.name} (${p.homeShiftName})` : p.name)).join(', ');

async function toBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], { type: XLSX_MIME });
}

export async function buildReportXlsx(r: ShiftRecord): Promise<Blob> {
  const wb = new (await loadExcel()).Workbook();
  const ws = wb.addWorksheet('Report');
  const s = r.stats;
  ws.getCell('A1').value = 'Report obsadenosti – Frézy';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value =
    `Dátum: ${skDate(r.date)}   Zmena: ${r.shiftName}   Majster: ${r.foremanName}   Uzavreté: ${hhmm(r.closedAt)}`;
  ws.getCell('A3').value =
    `Strojov: ${s.total}   Obsadené: ${s.occupied} (${formatPct(s.occupancyPct)})   ` +
    `EXT: ${s.ext} (${formatPct(s.extPct)})   INT: ${s.int} (${formatPct(s.intPct)})`;
  const oos = r.rows.filter((x) => x.outOfService).length;
  if (oos > 0) ws.getCell('A4').value = `Mimo prevádzky: ${oos}`;

  const header = ws.getRow(6);
  header.values = ['Stroj', 'Zakázka', 'Ľudia', 'Nadčas'];
  header.font = { bold: true };
  r.rows.forEach((row, i) => {
    const xr = ws.getRow(7 + i);
    xr.values = [
      row.machineName,
      typeLabel(row),
      peopleLabel(row),
      row.people.some((p) => p.overtime) ? 'áno' : '',
    ];
    if (row.type && !row.outOfService) {
      xr.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[row.type] } };
    }
  });
  ws.columns.forEach((c, i) => (c.width = [24, 16, 40, 10][i]));
  return toBlob(wb);
}

export async function buildHistoryXlsx(records: ShiftRecord[]): Promise<Blob> {
  const wb = new (await loadExcel()).Workbook();
  const ws = wb.addWorksheet('História');
  ws.addRow(['Dátum', 'Zmena', 'Majster', 'Strojov', 'Obsadené', 'Obsadenosť %', 'EXT', 'INT', 'EXT %', 'INT %']).font = { bold: true };
  for (const r of records) {
    const s = r.stats;
    ws.addRow([
      skDate(r.date), r.shiftName, r.foremanName, s.total, s.occupied,
      s.occupancyPct ?? '–', s.ext, s.int, s.extPct ?? '–', s.intPct ?? '–',
    ]);
  }
  ws.columns.forEach((c) => (c.width = 14));
  return toBlob(wb);
}
