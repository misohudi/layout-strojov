import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from '../useDB';
import { getMeta, setMeta } from '../../db/db';
import { backupFileName, exportBackup, importBackup } from '../../backup/backup';
import { shareOrDownload } from '../../report/share';

export function BackupSettings() {
  const db = useDB();
  const last = useLiveQuery(() => getMeta<string>(db, 'lastBackupAt'), [db]);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const now = new Date();
    const res = await shareOrDownload(await exportBackup(db), backupFileName(now));
    if (res !== 'cancelled') await setMeta(db, 'lastBackupAt', now.toISOString());
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (!window.confirm('Obnovenie prepíše všetky aktuálne dáta v tablete. Pokračovať?')) return;
    try {
      await importBackup(db, file);
      setMsg('Záloha bola obnovená.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="card stack">
      <p>
        Dáta sú uložené len v tomto tablete. Pravidelne si ukladajte zálohu (napr. do e-mailu alebo na disk).
        <br />
        <span className="muted">
          Posledná záloha: {last ? new Date(last).toLocaleString('sk-SK') : 'zatiaľ žiadna'}
        </span>
      </p>
      <div className="row">
        <button className="btn btn--primary" onClick={save}>Uložiť zálohu</button>
      </div>
      <label className="field">
        <span>Obnoviť zo zálohy (.json)</span>
        <input type="file" accept=".json,application/json" onChange={(e) => restore(e.target.files?.[0])} />
      </label>
      {msg && <div className="notice">{msg}</div>}
    </div>
  );
}
