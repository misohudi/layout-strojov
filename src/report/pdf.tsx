import { drawRecordPages } from './pdfDraw';
import { APP_UPDATED_MESSAGE } from './excel';
import { localDate } from '../domain/record';
import { reportBaseName } from './xlsx';
import type { ShiftRecord } from '../domain/types';

/** File name of the history PDF (one record: its shift and date). */
export function pdfFileName(records: ShiftRecord[], now = new Date()): string {
  if (records.length === 1) return `${reportBaseName(records[0])}.pdf`;
  return `Historia_layoutov_${localDate(now.toISOString())}.pdf`;
}

async function loadPdfLib() {
  try {
    return (await import('jspdf')).jsPDF;
  } catch {
    throw new Error(APP_UPDATED_MESSAGE); // an old chunk that no longer exists after an update
  }
}

/** Lets the screen update between pages (the "Pripravujem…" stays alive on a slow tablet). */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * PDF of closed shifts: for each one the plan of every zone as in the history, then the table of
 * machines and people (A4 landscape), drawn onto a canvas (see pdfDraw).
 */
export async function buildRecordsPdf(records: ShiftRecord[]): Promise<Blob> {
  const jsPDF = await loadPdfLib();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  let first = true;
  for (const record of records) {
    for (const page of await drawRecordPages(record)) {
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(page.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pw, ph);
      await breathe();
    }
  }
  return pdf.output('blob');
}
