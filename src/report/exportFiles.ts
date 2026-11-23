import { buildHistoryXlsx, buildReportXlsx, reportBaseName } from './xlsx';
import { buildRecordsPdf, pdfFileName } from './pdf';
import { localDate } from '../domain/record';
import type { OutFile } from './folder';
import type { ShiftRecord } from '../domain/types';

export interface FileTypes {
  excel: boolean;
  pdf: boolean;
}

/** The month subfolder of a shift in the report folder: "2026-11" (by the shift's date). */
export const monthFolder = (r: Pick<ShiftRecord, 'date'>) => r.date.slice(0, 7);

/**
 * The files of a report export. `perShift`: an Excel / PDF for every shift (named after the shift and
 * placed in its month's subfolder); otherwise one overview Excel and one PDF with all the shifts.
 */
export async function buildExportFiles(records: ShiftRecord[], types: FileTypes, perShift: boolean): Promise<OutFile[]> {
  const files: OutFile[] = [];
  if (perShift || records.length === 1) {
    for (const r of records) {
      const base = reportBaseName(r);
      if (types.excel) files.push({ name: `${base}.xlsx`, blob: await buildReportXlsx(r), folder: monthFolder(r) });
      if (types.pdf) files.push({ name: `${base}.pdf`, blob: await buildRecordsPdf([r]), folder: monthFolder(r) });
    }
    return files;
  }
  if (types.excel) {
    files.push({ name: `Historia_obsadenosti_${localDate(new Date().toISOString())}.xlsx`, blob: await buildHistoryXlsx(records) });
  }
  if (types.pdf) files.push({ name: pdfFileName(records), blob: await buildRecordsPdf(records) });
  return files;
}
