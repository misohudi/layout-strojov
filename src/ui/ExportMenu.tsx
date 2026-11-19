import { useRef, useState } from 'react';
import { buildRecordsPdf } from '../report/pdf';
import type { ShiftRecord } from '../domain/types';

export interface ExportAction {
  label: string;
  /** Runs the export; the menu closes when it is done. */
  run(): Promise<unknown> | unknown;
  /** Not ready yet (e.g. the file is still being made). */
  disabled?: boolean;
}
export interface ExportGroup {
  title: string;
  note?: string;
  actions: ExportAction[];
}

/**
 * One "Exportovať" button: a tap opens a sheet with every way out – PDF or Excel, downloaded to the
 * device or shared – and the user chooses there.
 */
export function ExportMenu({ groups, disabled = false }: { groups: ExportGroup[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(a: ExportAction) {
    setBusy(a.label);
    setError(null);
    try {
      await a.run();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button className="btn btn--primary" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Exportovať
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={() => !busy && setOpen(false)}>
          <div className="sheet export-menu" role="dialog" aria-label="Exportovať" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2>Exportovať</h2>
              <button className="btn" disabled={!!busy} onClick={() => setOpen(false)}>Zavrieť</button>
            </div>
            {groups.map((g) => (
              <section key={g.title} className="export-menu__group" aria-label={g.title}>
                <h3>{g.title}</h3>
                {g.note && <p className="muted export-menu__note">{g.note}</p>}
                <div className="row">
                  {g.actions.map((a) => (
                    <button
                      key={a.label}
                      className="btn btn--primary"
                      disabled={!!busy || a.disabled}
                      onClick={() => choose(a)}
                    >
                      {busy === a.label ? 'Pripravujem…' : a.label}
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {error && <div className="notice notice--warn">{error}</div>}
          </div>
        </div>
      )}
    </>
  );
}

/** The PDF of these records, made once and kept (a second choice is instant). */
export function usePdf(records: ShiftRecord[]) {
  const made = useRef<{ key: string; blob: Blob } | null>(null);
  const key = records.map((r) => r.id).join('|');
  return async (): Promise<Blob> => {
    if (made.current?.key === key) return made.current.blob;
    const blob = await buildRecordsPdf(records);
    made.current = { key, blob };
    return blob;
  };
}
