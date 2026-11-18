import { useEffect, useState } from 'react';
import { PeopleSettings } from './PeopleSettings';
import { MachineEditor } from './MachineEditor';
import { ShiftSettings } from './ShiftSettings';
import { BackupSettings } from './BackupSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { ReportSettings } from './ReportSettings';
import { HallSettings } from './HallSettings';
import { BackIcon } from '../icons';

const TABS = [
  { id: 'halls', label: 'Oddelenia' },
  { id: 'machines', label: 'Stroje' },
  { id: 'shifts', label: 'Zmeny' },
  { id: 'people', label: 'Ľudia' },
  { id: 'report', label: 'Report' },
  { id: 'backup', label: 'Záloha' },
  { id: 'appearance', label: 'Vzhľad' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** A swipe: one finger, mostly sideways, at least this far. */
const SWIPE_PX = 60;

/** Is the element (or one around it) a strip that scrolls sideways? Then the swipe scrolls it. */
function scrollsSideways(el: Element | null): boolean {
  for (let e = el; e && e instanceof HTMLElement; e = e.parentElement) {
    const o = getComputedStyle(e).overflowX;
    if ((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth + 1) return true;
  }
  return false;
}

/** Neighbouring tab; past the last one it goes round to the first (and back). */
export function stepTab(tab: Tab, dir: 1 | -1): Tab {
  const i = TABS.findIndex((t) => t.id === tab);
  return TABS[(i + dir + TABS.length) % TABS.length].id;
}

export function SettingsView({ onBack, initialTab = 'people' }: { onBack(): void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  // listens on the whole screen, not just the settings block: empty space below and beside it counts too
  useEffect(() => {
    let swipe: { x: number; y: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.target as Element;
      // the machine plan is dragged and panned with a finger; form fields keep their own gestures
      const own = t.closest?.('.floor, input, textarea, select') || scrollsSideways(t);
      swipe = e.touches.length === 1 && !own ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) swipe = null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const s = swipe;
      swipe = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
      setTab((cur) => stepTab(cur, dx < 0 ? 1 : -1));
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);
  return (
    <div className="page">
      <h2 className="visually-hidden">Nastavenia</h2>
      {/* round back button in one row with the tabs */}
      <div className="tabs settings__bar">
        <button type="button" className="chip chip--round" aria-label="Späť" title="Späť" onClick={onBack}>
          <BackIcon />
        </button>
        <div className="tabs" role="tablist" aria-label="Nastavenia">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`chip ${tab === t.id ? 'chip--on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'people' && <PeopleSettings />}
      {tab === 'halls' && <HallSettings />}
      {tab === 'machines' && <MachineEditor />}
      {tab === 'shifts' && <ShiftSettings />}
      {tab === 'report' && <ReportSettings />}
      {tab === 'backup' && <BackupSettings />}
      {tab === 'appearance' && <AppearanceSettings />}
    </div>
  );
}
