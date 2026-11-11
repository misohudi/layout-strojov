import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from '../useDB';
import { deletePerson, setPersonActive, upsertPerson } from '../../db/repo';
import { applyPeopleImport, parsePeopleFile, type PeopleImportResult } from '../../import/peopleImport';
import { isPool, type Person } from '../../domain/types';

function PersonRow({ p, shifts }: { p: Person; shifts: { id: string; name: string }[] }) {
  const db = useDB();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [shiftId, setShiftId] = useState(p.shiftId);

  if (editing) {
    return (
      <li className="row person-row">
        <input aria-label={`Meno – ${p.name}`} value={name} onChange={(e) => setName(e.target.value)} />
        <select aria-label={`Zmena – ${p.name}`} value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
          {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button
          className="btn btn--small"
          disabled={!name.trim()}
          onClick={async () => {
            await upsertPerson(db, { ...p, name: name.trim(), shiftId });
            setEditing(false);
          }}
        >
          Uložiť
        </button>
        <button className="btn btn--small" onClick={() => setEditing(false)}>Zrušiť</button>
      </li>
    );
  }
  return (
    <li className={`row person-row ${p.active ? '' : 'muted'}`}>
      <span className="person-row__name">{p.name}{!p.active && ' (neaktívny)'}</span>
      <button className="btn btn--small" aria-label={`Upraviť ${p.name}`} onClick={() => setEditing(true)}>Upraviť</button>
      <button
        className="btn btn--small"
        aria-label={`${p.active ? 'Deaktivovať' : 'Aktivovať'} ${p.name}`}
        onClick={() => setPersonActive(db, p.id, !p.active)}
      >
        {p.active ? 'Deaktivovať' : 'Aktivovať'}
      </button>
      <button
        className="btn btn--small btn--danger"
        aria-label={`Odstrániť ${p.name}`}
        onClick={() => window.confirm(`Odstrániť ${p.name}?`) && deletePerson(db, p.id)}
      >
        Odstrániť
      </button>
    </li>
  );
}

export function PeopleSettings() {
  const db = useDB();
  const shifts = useLiveQuery(() => db.shifts.orderBy('order').toArray(), [db]) ?? [];
  const people = useLiveQuery(() => db.people.toArray(), [db]) ?? [];
  const [name, setName] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [result, setResult] = useState<PeopleImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [removeUnused, setRemoveUnused] = useState(true);

  async function add() {
    const sid = shiftId || shifts[0]?.id;
    if (!name.trim() || !sid) return;
    await upsertPerson(db, { name: name.trim(), shiftId: sid, active: true });
    setName('');
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setImportError(null);
    try {
      setResult(await applyPeopleImport(db, await parsePeopleFile(file), { removeUnusedShifts: removeUnused }));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="stack">
      <div className="card row">
        <label className="field">
          <span>Meno</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </label>
        <label className="field">
          <span>Zmena</span>
          <select value={shiftId || shifts[0]?.id || ''} onChange={(e) => setShiftId(e.target.value)}>
            {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <button className="btn btn--primary" disabled={!name.trim()} onClick={add}>Pridať</button>
      </div>

      <div className="card">
        <label className="field">
          <span>Importovať zo súboru (Excel alebo CSV so stĺpcami „Meno“ a „Zmena“)</span>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <p className="muted">
          Podporované sú aj zoznamy so stĺpcom pre každú zmenu („Smena Novák“, „Smena Kováč“…) a stĺpcom „Všetci“ –
          zmeny sa vytvoria automaticky a ľudia bez zmeny pôjdu do skupiny „Ostatní“.
        </p>
        <label className="check">
          <input type="checkbox" checked={removeUnused} onChange={(e) => setRemoveUnused(e.target.checked)} />
          <span>Odstrániť prázdne zmeny, ktoré v súbore nie sú (napr. A, B, C)</span>
        </label>
        {importError && <div className="notice notice--warn">{importError}</div>}
        {result && (
          <div className="notice">
            Pridaných {result.added}, preskočených {result.skipped}.
            {result.shiftsCreated.length > 0 && <div>Vytvorené zmeny: {result.shiftsCreated.join(', ')}</div>}
            {result.shiftsRemoved.length > 0 && <div>Odstránené prázdne zmeny: {result.shiftsRemoved.join(', ')}</div>}
            {result.errors.length > 0 && (
              <ul>
                {result.errors.map((e) => <li key={e.line}>Riadok {e.line}: {e.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {shifts.map((s) => {
        const list = people.filter((p) => p.shiftId === s.id).sort((a, b) => a.name.localeCompare(b.name, 'sk'));
        return (
          <section key={s.id} className="card" aria-label={isPool(s) ? s.name : `Zmena ${s.name}`}>
            <h3>{isPool(s) ? s.name : `Zmena ${s.name}`} <span className="muted">({list.filter((p) => p.active).length})</span></h3>
            {list.length === 0 ? (
              <p className="muted">Žiadni ľudia.</p>
            ) : (
              <ul className="plain-list">
                {list.map((p) => <PersonRow key={p.id} p={p} shifts={shifts} />)}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
