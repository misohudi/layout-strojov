import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import eggUrl from '../assets/easter-egg.webp';

const TAPS = 5;
/** All five taps have to happen within this time. */
const WINDOW_MS = 2000;
const SHOW_MS = 7000;

/** Counts quick taps on empty space of the plan (taps on machines or buttons don't count). */
export function useEasterEgg() {
  const taps = useRef<number[]>([]);
  const [visible, setVisible] = useState(false);

  const onPlanClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.tile, button, a, input')) {
      taps.current = [];
      return;
    }
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < WINDOW_MS), now];
    if (taps.current.length >= TAPS) {
      taps.current = [];
      setVisible(true);
    }
  }, []);

  const hide = useCallback(() => setVisible(false), []);
  return { visible, onPlanClick, hide };
}

export function EasterEgg({ visible, onHide }: { visible: boolean; onHide(): void }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHide, SHOW_MS);
    return () => clearTimeout(t);
  }, [visible, onHide]);

  if (!visible) return null;
  return (
    <div className="easter-egg">
      <img src={eggUrl} alt="Prekvapenie" onClick={onHide} draggable={false} />
    </div>
  );
}
