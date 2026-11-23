import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { RecordSheets, PAGE_W, PAGE_H } from '../ui/RecordSheets';
import { APP_UPDATED_MESSAGE } from './excel';
import { localDate } from '../domain/record';
import { reportBaseName } from './xlsx';
import type { ShiftRecord } from '../domain/types';

/** File name of the history PDF (one record: its shift and date). */
export function pdfFileName(records: ShiftRecord[], now = new Date()): string {
  if (records.length === 1) return `${reportBaseName(records[0])}.pdf`;
  return `Historia_layoutov_${localDate(now.toISOString())}.pdf`;
}

/** The plan measures its area after the first paint and lays itself out again – wait for that. */
const settle = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60))));

/**
 * Icons and the logo take their colours from CSS variables and classes, which the page-to-image step
 * does not resolve inside SVG (icons came out white, the logo black). Write the resolved colours on.
 */
function inlineSvgPaint(page: HTMLElement) {
  for (const el of Array.from(page.querySelectorAll<SVGElement>('svg *'))) {
    const cs = getComputedStyle(el);
    el.style.fill = cs.fill;
    el.style.stroke = cs.stroke;
  }
}

async function loadLibs() {
  try {
    const [{ jsPDF }, htmlToImage] = await Promise.all([import('jspdf'), import('html-to-image')]);
    return { jsPDF, htmlToImage };
  } catch {
    throw new Error(APP_UPDATED_MESSAGE); // an old chunk that no longer exists after an update
  }
}

/**
 * PDF of closed shifts: for each one the plan of every zone as in the history, then the table of
 * machines and people (A4 landscape). The pages are drawn off-screen in the light theme and turned
 * into images, so they look exactly like the app.
 */
export async function buildRecordsPdf(records: ShiftRecord[]): Promise<Blob> {
  const { jsPDF, htmlToImage } = await loadLibs();
  const host = document.createElement('div');
  host.className = 'pdf-host';
  document.body.appendChild(host);
  const root = createRoot(host);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  let first = true;
  try {
    await document.fonts?.ready;
    for (const record of records) {
      flushSync(() => root.render(<RecordSheets record={record} />));
      await settle();
      await settle();
      for (const page of Array.from(host.querySelectorAll<HTMLElement>('.pdf-page'))) {
        inlineSvgPaint(page);
        const img = await htmlToImage.toJpeg(page, {
          quality: 0.9,
          pixelRatio: 2,
          width: PAGE_W,
          height: PAGE_H,
          backgroundColor: '#ffffff',
        });
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(img, 'JPEG', 0, 0, pw, ph);
      }
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return pdf.output('blob');
}
