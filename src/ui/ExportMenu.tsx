import { useEffect, useRef, useState } from 'react';
import { useDB } from './useDB';
import { buildExportFiles, type FileTypes } from '../report/exportFiles';
import {
  filesResultMessage, getReportFolder, requestFolderAccess, saveFilesToReportFolder, type FolderHandle, type OutFile,
} from '../report/folder';
import { downloadBlob, shareOrDownloadFiles } from '../report/share';
import type { ShiftRecord } from '../domain/types';

type Where = 'folder' | 'download' | 'share';

/**
 * One "Exportovať" button (history, shift detail, after closing a shift). In its sheet the files are
 * chosen first – Excel and/or PDF – and then where they go: into the report folder (Nastavenia →
 * Report, e.g. a network share; every shift its own files in the month's subfolder), downloaded to the
 * device, or shared. With several shifts, downloading / sharing asks for one overview or a file per
 * shift. Files already in the folder are replaced only after asking.
 */
export function ExportMenu({ records, label = 'Exportovať', primary = true }: { records: ShiftRecord[]; label?: string; primary?: boolean }) {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<FileTypes>({ excel: false, pdf: false });
  /** Several shifts, downloaded or shared: one overview (false) or a file per shift (true); not chosen yet = null. */
  const [perShift, setPerShift] = useState<boolean | null>(null);
  const [folder, setFolder] = useState<FolderHandle | null>(null);
  const [busy, setBusy] = useState<Where | null>(null);
  const [error, setError] = useState<{ message: string; failed: Where } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** Files already in the folder: the question and its answer. */
  const [ask, setAsk] = useState<{ names: string[]; answer(replace: boolean): void } | null>(null);
  const made = useRef<{ key: string; files: OutFile[] } | null>(null);

  useEffect(() => {
    if (open) getReportFolder(db).then((h) => setFolder(h ?? null));
  }, [db, open]);

  const several = records.length > 1;
  const anyType = types.excel || types.pdf;
  const needsSplit = several && perShift === null;

  /** The files, made once per choice (a second destination reuses them). */
  async function files(split: boolean): Promise<OutFile[]> {
    const key = `${records.map((r) => r.id).join('|')}:${types.excel}:${types.pdf}:${split}`;
    if (made.current?.key === key) return made.current.files;
    const out = await buildExportFiles(records, types, split);
    made.current = { key, files: out };
    return out;
  }

  async function run(where: Where, split = !!perShift) {
    setBusy(where);
    setError(null);
    setDone(null);
    try {
      if (where === 'folder') {
        if (folder) await requestFolderAccess(folder); // first, while it still counts as the user's tap
        const res = await saveFilesToReportFolder(db, await files(true), (names) =>
          new Promise<boolean>((resolve) => setAsk({ names, answer: resolve })),
        );
        setAsk(null);
        if (!res.ok) {
          setError({ message: filesResultMessage(res), failed: 'folder' });
          return;
        }
        setDone(filesResultMessage(res));
        return;
      }
      const out = await files(split);
      if (where === 'download') out.forEach((f) => downloadBlob(f.blob, f.name));
      else await shareOrDownloadFiles(out);
      setOpen(false);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : String(e), failed: where });
    } finally {
      setBusy(null);
    }
  }

  /** Every export starts from scratch: the file types are always chosen anew. */
  const openSheet = () => {
    setTypes({ excel: false, pdf: false });
    setPerShift(null);
    setError(null);
    setDone(null);
    setOpen(true);
  };
  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
    setDone(null);
  };
  const check = (key: keyof FileTypes) => (
    <label className={`person ${types[key] ? 'person--on' : ''}`}>
      <input type="checkbox" checked={types[key]} onChange={() => setTypes({ ...types, [key]: !types[key] })} />
      <span>{key === 'excel' ? 'Excel' : 'PDF'}</span>
      <small className="person__count">{key === 'excel' ? 'tabuľka' : 'plán a tabuľka'}</small>
    </label>
  );

  return (
    <>
      <button className={`btn ${primary ? 'btn--primary' : ''}`} disabled={records.length === 0} aria-haspopup="dialog" onClick={openSheet}>
        {label}
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={close}>
          <div className="sheet export-menu" role="dialog" aria-label="Exportovať" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2>Exportovať</h2>
              <button className="btn" disabled={!!busy} onClick={close}>Zavrieť</button>
            </div>

            <section className="export-menu__group" aria-label="Súbory">
              <h3>1. Súbory</h3>
              <div className="people-list">
                {check('excel')}
                {check('pdf')}
              </div>
            </section>

            <section className="export-menu__group" aria-label="Kam">
              <h3>2. Kam</h3>
              <div className="row">
                <button className="btn btn--primary" disabled={!anyType || !folder || !!busy} onClick={() => run('folder')}>
                  {busy === 'folder' ? 'Ukladám…' : 'Uložiť do priečinka'}
                </button>
                <button className="btn btn--primary" disabled={!anyType || needsSplit || !!busy} onClick={() => run('download')}>
                  {busy === 'download' ? 'Pripravujem…' : 'Stiahnuť'}
                </button>
                <button className="btn btn--primary" disabled={!anyType || needsSplit || !!busy} onClick={() => run('share')}>
                  {busy === 'share' ? 'Pripravujem…' : 'Zdieľať'}
                </button>
              </div>
              {!folder && <p className="muted export-menu__note">Priečinok pre reporty nastavíte v Nastaveniach → Report.</p>}
              {folder && <p className="muted export-menu__note">{`Do priečinka ${folder.name}: každá zmena zvlášť, v podpriečinku mesiaca (napr. 2026-11).`}</p>}
              {several && (
                <div className="row" role="radiogroup" aria-label="Pri stiahnutí a zdieľaní">
                  <span className="muted">Pri stiahnutí a zdieľaní:</span>
                  <label className="check">
                    <input type="radio" name="split" checked={perShift === false} onChange={() => setPerShift(false)} />
                    Spoločný súbor
                  </label>
                  <label className="check">
                    <input type="radio" name="split" checked={perShift === true} onChange={() => setPerShift(true)} />
                    Za každú zmenu
                  </label>
                </div>
              )}
              {!anyType && <p className="muted export-menu__note">Najprv vyberte Excel, PDF alebo oboje.</p>}
            </section>

            {ask && (
              <div className="notice notice--warn" role="alertdialog" aria-label="Súbory už existujú">
                <div>
                  {`V priečinku už ${ask.names.length === 1 ? 'je' : 'sú'}: ${ask.names.join(', ')}. Prepísať?`}
                </div>
                <div className="row">
                  <button className="btn btn--small btn--primary" onClick={() => ask.answer(true)}>Prepísať</button>
                  <button className="btn btn--small" onClick={() => ask.answer(false)}>Ponechať</button>
                </div>
              </div>
            )}
            {done && <div className="notice notice--ok">{done}</div>}
            {error && (
              <div className="notice notice--warn" role="alert">
                <div>{error.message}</div>
                {error.failed === 'folder' && (
                  // the folder is not reachable (tablet off the company Wi-Fi, share down…): try again or take the files another way
                  <div className="row">
                    <button className="btn btn--small" onClick={() => run('folder')}>Skúsiť znova</button>
                    <button className="btn btn--small" onClick={() => run('download', true)}>Stiahnuť</button>
                    <button className="btn btn--small" onClick={() => run('share', true)}>Zdieľať</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
