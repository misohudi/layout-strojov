import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from './useDB';
import { PLAN_FRAME, cropped } from './grid';
import { Header } from './Header';
import { Floor } from './Floor';
import { MachineTile } from './MachineTile';
import { MachinePanel } from './MachinePanel';
import { MachineList } from './MachineList';
import { Legend, matchesLegend, type LegendKey } from './Legend';
import { EasterEgg, useEasterEgg } from './EasterEgg';
import { computeStats } from '../domain/stats';
import { clearDraft, copyFromLastRecord } from '../db/repo';
import { isPool, type Hall } from '../domain/types';

/** The zone last shown on this tablet (a per-device convenience; storage may be unavailable). */
/** Slovak plural: 1 stroj, 2–4 stroje, 5+ (and 0) strojov. */
export function machinesCount(n: number): string {
  return `${n} ${n === 1 ? 'stroj' : n >= 2 && n <= 4 ? 'stroje' : 'strojov'}`;
}

const ZONE_KEY = 'layout-strojov.zone';
function readZone(): string | null {
  try {
    return localStorage.getItem(ZONE_KEY);
  } catch {
    return null;
  }
}
function storeZone(id: string) {
  try {
    localStorage.setItem(ZONE_KEY, id);
  } catch {
    /* not remembered – fine */
  }
}

/** Small per-device notes for one open shift (storage may be unavailable – then they just reset). */
function readNote<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function writeNote(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* not remembered – fine */
  }
}

/** "i" in a circle at the start of an info bar. */
const InfoIcon = () => (
  <svg className="plan-offer__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 11v6" />
    <circle cx="12" cy="7.5" r="0.6" fill="currentColor" />
  </svg>
);

/** A swipe: one finger, mostly sideways, at least this far. */
const SWIPE_PX = 60;

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

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
  // all zones of the department: the stats count them all, the plan shows one zone at a time
  const machines = useLiveQuery(() => db.machines.toArray(), [db]);
  const halls = useLiveQuery(() => db.halls.orderBy('order').toArray(), [db]) ?? [];
  const [zoneId, setZoneId] = useState<string | null>(readZone);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  // null = loaded but no draft (shift deleted, backup restored, closed); undefined = still loading
  const draftResult = useLiveQuery(async () => (await db.drafts.get(shiftId)) ?? null, [db, shiftId]);
  const people = useLiveQuery(() => db.people.toArray(), [db]) ?? [];
  const shifts = useLiveQuery(() => db.shifts.orderBy('order').toArray(), [db]) ?? [];
  const recordCount = useLiveQuery(() => db.records.count(), [db]) ?? 0;
  const [openId, setOpenId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  /** Legend item whose machines are highlighted on the plan. */
  const [legendKey, setLegendKey] = useState<LegendKey | null>(null);
  /** A machine opened from the machine list returns to the list when closed. */
  const [backToList, setBackToList] = useState(false);
  const egg = useEasterEgg();
  // per open shift: whether the "take over from the last shift" card was closed, and which zones the
  // foreman has already looked at (the arrows towards the others pulse)
  const draftKey = draftResult ? `layout-strojov.shift.${shiftId}.${draftResult.startedAt}` : null;
  const [offerClosed, setOfferClosed] = useState<string | null>(null);
  const [seen, setSeen] = useState<{ key: string | null; ids: string[] }>({ key: null, ids: [] });
  const currentZone = halls[Math.max(0, halls.findIndex((h) => h.id === zoneId))]?.id;
  useEffect(() => {
    if (!draftKey || !currentZone) return;
    const ids = readNote<string[]>(`${draftKey}.seen`, []);
    const next = ids.includes(currentZone) ? ids : [...ids, currentZone];
    if (next !== ids) writeNote(`${draftKey}.seen`, next);
    setSeen({ key: draftKey, ids: next });
  }, [draftKey, currentZone]);

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
  const stats = computeStats(machines, draft.assignments, people);
  const counts: Record<string, number> = {};
  for (const m of machines) {
    if (m.status !== 'active') continue;
    for (const pid of draft.assignments[m.id]?.personIds ?? []) counts[pid] = (counts[pid] ?? 0) + 1;
  }
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const personOf = new Map(people.map((p) => [p.id, p]));
  const open = machines.find((m) => m.id === openId);
  const zoneIdx = Math.max(0, halls.findIndex((h) => h.id === zoneId));
  const hall = halls[zoneIdx] as Hall | undefined;
  const inZone = hall ? machines.filter((m) => m.hallId === hall.id) : machines;
  // every zone is zoomed to its own machines (the empty floor around them is not drawn)
  const visible = inZone.length > 0 ? cropped(inZone) : inZone;
  const multiZone = halls.length > 1;
  const goZone = (delta: number) => {
    const next = halls[zoneIdx + delta];
    if (!next) return;
    setZoneId(next.id);
    storeZone(next.id);
  };
  const onTouchStart = (e: TouchEvent) => {
    swipe.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 1) swipe.current = null; // pinch zoom, not a swipe
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    const t = e.changedTouches[0];
    if (!s || !t || !multiZone) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    // a zoomed plan that pans sideways keeps the swipe for panning
    const scroller = zoneRef.current?.querySelector<HTMLElement>('[data-testid="floor-scroll"]');
    if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) return;
    goZone(dx < 0 ? 1 : -1);
  };
  const isEmpty = Object.keys(draft.assignments).length === 0;
  const showOffer =
    isEmpty && recordCount > 0 && offerClosed !== draftKey && !(draftKey && readNote(`${draftKey}.offerClosed`, false));
  /**
   * Arrow towards zones the foreman has not looked at yet in this shift: it pulses, and turns yellow
   * when one of those zones has a priority order.
   */
  const seenIds = seen.key === draftKey ? seen.ids : [];
  /** Does a zone have machines of the given legend item (priority, EXT, INT, out of service…)? */
  const zoneHas = (key: LegendKey, hallId: string) =>
    machines.some((m) => m.hallId === hallId && matchesLegend(key, m, draft.assignments[m.id]));
  /**
   * Tapping a legend item: when the shown zone has no such machine but another zone does, the view
   * switches to the nearest of those zones.
   */
  const selectLegend = (key: LegendKey | null) => {
    setLegendKey(key);
    if (!key || !multiZone || (hall && zoneHas(key, hall.id))) return;
    const target = halls
      .map((h, i) => ({ h, d: Math.abs(i - zoneIdx) }))
      .filter(({ h }) => zoneHas(key, h.id))
      .sort((a, b) => a.d - b.d)[0];
    if (target) {
      setZoneId(target.h.id);
      storeZone(target.h.id);
    }
  };
  const arrowClass = (dir: -1 | 1) => {
    const ahead = dir < 0 ? halls.slice(0, zoneIdx) : halls.slice(zoneIdx + 1);
    // a legend item is selected: the arrow towards zones with such machines lights up in its colour
    if (legendKey && ahead.some((h) => zoneHas(legendKey, h.id))) {
      return `zone__arrow--pulse zone__arrow--hl zone__arrow--hl-${legendKey}`;
    }
    const unseen = ahead.filter((h) => !seenIds.includes(h.id));
    if (unseen.length === 0) return '';
    const prio = machines.some(
      (m) => unseen.some((h) => h.id === m.hallId) && m.status === 'active' && !!draft.assignments[m.id]?.type && !!draft.assignments[m.id]?.priority,
    );
    return `zone__arrow--pulse ${prio ? 'zone__arrow--prio' : ''}`;
  };

  return (
    <div className="screen">
      <Header
        shiftName={shift?.name ?? '?'}
        longestShiftName={Math.max(1, ...shifts.filter((s) => !isPool(s)).map((s) => s.name.length))}
        stats={stats}
        onChangeShift={onChangeShift}
        onHistory={onHistory}
        onSettings={onSettings}
        onMachineList={() => setListOpen(true)}
      />
      {banner}
      <div className="plan-area">
        {/* info bars: a see-through yellowish layer over the zone name, not pushing the plan down */}
        {(showOffer || stats.peopleWithoutType > 0) && (
          <div className="plan-notes">
            {stats.peopleWithoutType > 0 && (
              <div className="plan-offer" role="alert">
                <InfoIcon />
                <span>
                  {stats.peopleWithoutType === 1
                    ? '1 stroj má ľudí, ale nemá určený typ zakázky.'
                    : `${machinesCount(stats.peopleWithoutType)} ${stats.peopleWithoutType <= 4 ? 'majú' : 'má'} ľudí, ale ${stats.peopleWithoutType <= 4 ? 'nemajú' : 'nemá'} určený typ zakázky.`}
                </span>
              </div>
            )}
            {showOffer && (
              <div className="plan-offer" role="status">
                <InfoIcon />
                <span>Pôdorys je prázdny.</span>
                <button className="btn btn--small" onClick={() => copyFromLastRecord(db, shiftId)}>
                  Prevziať zakázky a priority z poslednej zmeny
                </button>
                <button
                  type="button"
                  className="plan-offer__close"
                  aria-label="Zavrieť bez prevzatia"
                  title="Zavrieť bez prevzatia"
                  onClick={() => {
                    if (draftKey) writeNote(`${draftKey}.offerClosed`, true);
                    setOfferClosed(draftKey);
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}
        {multiZone && hall && (
          <div className="zonebar">
            <h2 className="zonebar__name" aria-live="polite">{hall.name}</h2>
            <span className="zonebar__dots" aria-hidden="true">
              {halls.map((h) => <i key={h.id} className={h.id === hall.id ? 'on' : ''} />)}
            </span>
          </div>
        )}
        <div className="zone" ref={zoneRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {multiZone && (
            <button
              type="button"
              className={`zone__arrow ${arrowClass(-1)}`}
              aria-label={`Predchádzajúce oddelenie${halls[zoneIdx - 1] ? ` – ${halls[zoneIdx - 1].name}` : ''}`}
              disabled={zoneIdx === 0}
              onClick={() => goZone(-1)}
            >
              <Chevron dir="left" />
            </button>
          )}
          <Floor
            key={hall?.id}
            items={visible}
            frame={PLAN_FRAME}
            fill
            onPlanClick={egg.onPlanClick}
          >
            {visible.map((m) => {
              const a = draft.assignments[m.id];
              const hit = legendKey ? matchesLegend(legendKey, m, a) : null;
              return (
                <MachineTile
                  key={m.id}
                  {...m}
                  type={a?.type ?? null}
                  outOfService={m.status !== 'active'}
                  priority={!!a?.priority}
                  people={(a?.personIds ?? []).map((id) => {
                    const p = personOf.get(id);
                    return { name: p?.name ?? '?', role: p?.role, machines: counts[id] ?? 1 };
                  })}
                  highlighted={hit === true}
                  dimmed={hit === false}
                  onClick={() => setOpenId(m.id)}
                />
              );
            })}
          </Floor>
          {multiZone && (
            <button
              type="button"
              className={`zone__arrow ${arrowClass(1)}`}
              aria-label={`Ďalšie oddelenie${halls[zoneIdx + 1] ? ` – ${halls[zoneIdx + 1].name}` : ''}`}
              disabled={zoneIdx === halls.length - 1}
              onClick={() => goZone(1)}
            >
              <Chevron dir="right" />
            </button>
          )}
        </div>
      </div>
      <Legend stats={stats} selected={legendKey} onSelect={selectLegend}>
        <button
          className="btn btn--danger-outline"
          disabled={isEmpty}
          onClick={() =>
            window.confirm('Vyčistiť celý pôdorys? Zmažú sa zakázky, ľudia aj priority na všetkých strojoch tejto zmeny.') &&
            clearDraft(db, shiftId)
          }
        >
          Vyčistiť
        </button>
        <button className="btn btn--primary" onClick={onCloseShift}>Uzavrieť zmenu a vytvoriť report</button>
      </Legend>
      {listOpen && (
        <MachineList
          machines={machines}
          halls={halls}
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
      <EasterEgg visible={egg.visible} onHide={egg.hide} />
    </div>
  );
}
