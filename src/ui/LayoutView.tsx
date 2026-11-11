import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from './useDB';
import { Header } from './Header';
import { Floor } from './Floor';
import { MachineTile } from './MachineTile';
import { MachinePanel } from './MachinePanel';
import { MachineList } from './MachineList';
import { computeStats } from '../domain/stats';
import { copyFromLastRecord } from '../db/repo';
import { HALL_FREZY } from '../domain/seed';

interface Props {
  shiftId: string;
  onChangeShift(): void;
  onHistory(): void;
  onSettings(): void;
  onCloseShift(): void;
  banner?: React.ReactNode;
}

export function LayoutView({ shiftId, onChangeShift, onHistory, onSettings, onCloseShift, banner }: Props) {
  const db = useDB();
  const machines = useLiveQuery(() => db.machines.where('hallId').equals(HALL_FREZY).toArray(), [db]);
  // null = loaded but no draft (shift deleted, backup restored, closed); undefined = still loading
  const draftResult = useLiveQuery(async () => (await db.drafts.get(shiftId)) ?? null, [db, shiftId]);
  const people = useLiveQuery(() => db.people.toArray(), [db]) ?? [];
  const shifts = useLiveQuery(() => db.shifts.orderBy('order').toArray(), [db]) ?? [];
  const recordCount = useLiveQuery(() => db.records.count(), [db]) ?? 0;
  const [openId, setOpenId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  /** A machine opened from the machine list returns to the list when closed. */
  const [backToList, setBackToList] = useState(false);

  if (draftResult === null) {
    return (
      <div className="center-card">
        <h2>Táto zmena už nie je otvorená.</h2>
        <p className="muted">Mohla byť uzavretá, odstránená alebo obnovená zo zálohy.</p>
        <button className="btn btn--primary" onClick={onChangeShift}>Vybrať zmenu</button>
      </div>
    );
  }
  if (!machines || !draftResult) return <p className="muted pad">Načítavam…</p>;
  const draft = draftResult;
  const shift = shifts.find((s) => s.id === shiftId);
  const stats = computeStats(machines, draft.assignments);
  const counts: Record<string, number> = {};
  for (const m of machines) {
    if (m.status !== 'active') continue;
    for (const pid of draft.assignments[m.id]?.personIds ?? []) counts[pid] = (counts[pid] ?? 0) + 1;
  }
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const open = machines.find((m) => m.id === openId);
  const isEmpty = Object.keys(draft.assignments).length === 0;

  return (
    <div className="screen">
      <Header
        shiftName={shift?.name ?? '?'}
        stats={stats}
        onChangeShift={onChangeShift}
        onHistory={onHistory}
        onSettings={onSettings}
        onMachineList={() => setListOpen(true)}
      />
      {banner}
      {isEmpty && recordCount > 0 && (
        <div className="notice">
          Pôdorys je prázdny.
          <button className="btn btn--small" onClick={() => copyFromLastRecord(db, shiftId)}>
            Prevziať stav z poslednej zmeny
          </button>
        </div>
      )}
      {stats.peopleWithoutType > 0 && (
        <div className="notice notice--warn">
          {stats.peopleWithoutType === 1
            ? '1 stroj má ľudí, ale nemá určený typ zakázky.'
            : `${stats.peopleWithoutType} stroje/strojov majú ľudí, ale nemajú určený typ zakázky.`}
        </div>
      )}
      <Floor items={machines}>
        {machines.map((m) => {
          const a = draft.assignments[m.id];
          return (
            <MachineTile
              key={m.id}
              {...m}
              type={a?.type ?? null}
              outOfService={m.status !== 'active'}
              people={(a?.personIds ?? []).map((id) => nameOf.get(id) ?? '?')}
              onClick={() => setOpenId(m.id)}
            />
          );
        })}
      </Floor>
      <div className="legend">
        <span><i className="sw tile--ext" /> EXT – externá</span>
        <span><i className="sw tile--int" /> INT – interná</span>
        <span><i className="sw tile--free" /> voľný</span>
        <span><i className="sw tile--oos" /> mimo prevádzky</span>
        <button className="btn btn--primary" onClick={onCloseShift}>Uzavrieť zmenu a vytvoriť report</button>
      </div>
      {listOpen && (
        <MachineList
          machines={machines}
          assignments={draft.assignments}
          stats={stats}
          nameOf={nameOf}
          onPick={(id) => {
            setListOpen(false);
            setBackToList(true);
            setOpenId(id);
          }}
          onClose={() => setListOpen(false)}
        />
      )}
      {open && (
        <MachinePanel
          machine={open}
          assignment={draft.assignments[open.id]}
          shiftId={shiftId}
          people={people}
          shifts={shifts}
          counts={counts}
          onClose={() => {
            setOpenId(null);
            if (backToList) {
              setBackToList(false);
              setListOpen(true);
            }
          }}
        />
      )}
    </div>
  );
}
