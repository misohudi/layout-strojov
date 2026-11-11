import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from '../useDB';
import {
  forgetReportFolder, getFolderLabel, getReportFolder, isFolderSupported, pickReportFolder, setFolderLabel,
} from '../../report/folder';

export function ReportSettings() {
  const db = useDB();
  const supported = isFolderSupported();
  const [folder, setFolder] = useState<string | null>(null);
  const savedLabel = useLiveQuery(() => getFolderLabel(db), [db]);
  const [label, setLabel] = useState('');

  useEffect(() => {
    getReportFolder(db).then((h) => setFolder(h?.name ?? null));
  }, [db]);
  useEffect(() => setLabel(savedLabel ?? ''), [savedLabel]);

  return (
    <div className="card stack">
      <h3>Sieťový priečinok pre reporty</h3>
      {!supported ? (
        <div className="notice notice--warn">
          Tento prehliadač nevie ukladať priamo do priečinka. Report uložíte cez „Zdieľať report“ → aplikácia Súbory.
          Na tablete s Androidom použite aktuálny Chrome.
        </div>
      ) : (
        <>
          <p>
            {folder ? (
              <>Reporty sa pri uzavretí zmeny uložia do priečinka <strong>{folder}</strong>.</>
            ) : (
              'Priečinok zatiaľ nie je vybraný.'
            )}
          </p>
          <div className="row">
            <button
              className="btn btn--primary"
              onClick={async () => {
                const name = await pickReportFolder(db);
                if (name) setFolder(name);
              }}
            >
              {folder ? 'Zmeniť priečinok' : 'Vybrať priečinok'}
            </button>
            {folder && (
              <button
                className="btn"
                onClick={async () => {
                  await forgetReportFolder(db);
                  setFolder(null);
                }}
              >
                Nepoužívať priečinok
              </button>
            )}
          </div>
          <p className="muted">
            Vo výbere priečinka otvorte sieťový disk (ako v aplikácii Súbory) a zvoľte priečinok pre reporty.
            Prihlasovacie údaje k disku spravuje tablet, aplikácia ich nevidí.
          </p>
        </>
      )}
      <label className="field">
        <span>Cesta k priečinku (popis pre majstrov)</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="napr. Q:\…\REPORT_OBSADENOST" />
      </label>
      <div className="row">
        <button className="btn" disabled={label.trim() === (savedLabel ?? '')} onClick={() => setFolderLabel(db, label)}>
          Uložiť popis
        </button>
      </div>
    </div>
  );
}
