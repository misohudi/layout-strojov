import { useRef, useState } from 'react';
import { buildRecordsPdf, pdfFileName } from '../report/pdf';
import { downloadBlob, shareOrDownload } from '../report/share';
import type { ShiftRecord } from '../domain/types';

/**
 * "Stiahnuť PDF" saves the PDF straight to the device (on Android the share sheet has no "save" target);
 * "Zdieľať PDF" opens the share sheet. The PDF is made once and kept, so a second tap is instant – and
 * sharing then happens directly inside the tap, as the share sheet requires.
 */
export function PdfButtons({ records, onError }: { records: ShiftRecord[]; onError(message: string | null): void }) {
  const [busy, setBusy] = useState(false);
  const made = useRef<{ key: string; blob: Blob } | null>(null);
  const key = records.map((r) => r.id).join('|');

  async function pdf(): Promise<Blob> {
    if (made.current?.key === key) return made.current.blob;
    const blob = await buildRecordsPdf(records);
    made.current = { key, blob };
    return blob;
  }

  async function run(action: (blob: Blob, name: string) => unknown) {
    setBusy(true);
    onError(null);
    try {
      await action(await pdf(), pdfFileName(records));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || records.length === 0;
  return (
    <>
      <button className="btn btn--primary" disabled={disabled} onClick={() => run(downloadBlob)}>
        {busy ? 'Pripravujem PDF…' : 'Stiahnuť PDF'}
      </button>
      <button className="btn" disabled={disabled} onClick={() => run(shareOrDownload)}>
        Zdieľať PDF
      </button>
    </>
  );
}
