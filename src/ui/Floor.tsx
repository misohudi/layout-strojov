import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { gridTracks, type GridItem } from './grid';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Pinching back to just above 100 % snaps to exactly 100 %. */
const SNAP_BELOW = 1.08;
// Row height relative to column width is set in CSS (--rr): shorter in landscape, taller in portrait.

const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface Pinch {
  startDist: number;
  startZoom: number;
  /** Point of the plan under the fingers, as a fraction of the plan's size. */
  fx: number;
  fy: number;
}

/** Where the fingers are, relative to the scroll area. */
function midpoint(el: HTMLElement, touches: TouchList) {
  const r = el.getBoundingClientRect();
  const a = touches[0];
  const b = touches[1];
  return {
    x: (a.clientX + b.clientX) / 2 - r.left,
    y: (a.clientY + b.clientY) / 2 - r.top,
    dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
  };
}

/**
 * Scalable floor-plan grid. One finger pans the plan in any direction (native scrolling of its own
 * area); two fingers zoom it around the point between them. While zoomed, a semi-transparent
 * "100 %" button in the top-right corner returns to the full view and then disappears.
 */
export function Floor({ items, children }: { items: GridItem[]; children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinch = useRef<Pinch | null>(null);
  /** Scroll position to restore after the zoom re-renders, keeping the focal point under the fingers. */
  const anchor = useRef<{ fx: number; fy: number; x: number; y: number } | null>(null);
  const t = gridTracks(items);

  const applyZoom = (z: number) => {
    zoomRef.current = z;
    setZoom(z);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const m = midpoint(el, e.touches);
      if (m.dist <= 0) return;
      pinch.current = {
        startDist: m.dist,
        startZoom: zoomRef.current,
        fx: el.scrollWidth ? (el.scrollLeft + m.x) / el.scrollWidth : 0,
        fy: el.scrollHeight ? (el.scrollTop + m.y) / el.scrollHeight : 0,
      };
    };
    const onMove = (e: TouchEvent) => {
      const p = pinch.current;
      if (!p || e.touches.length !== 2) return;
      e.preventDefault(); // we handle the gesture; don't let the browser scroll or zoom the page
      const m = midpoint(el, e.touches);
      anchor.current = { fx: p.fx, fy: p.fy, x: m.x, y: m.y };
      applyZoom(clamp((p.startZoom * m.dist) / p.startDist));
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length >= 2) return;
      pinch.current = null;
      if (zoomRef.current < SNAP_BELOW && zoomRef.current !== 1) applyZoom(1);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.fx * el.scrollWidth - a.x;
    el.scrollTop = a.fy * el.scrollHeight - a.y;
    anchor.current = null;
  }, [zoom]);

  function reset() {
    anchor.current = null;
    applyZoom(1);
    scrollRef.current?.scrollTo({ left: 0, top: 0 });
  }

  return (
    <div className="floor">
      {zoom > 1 && (
        <button className="floor__reset" aria-label="Späť na 100 %" onClick={reset}>
          100 %
        </button>
      )}
      <div className="floor__scroll" data-testid="floor-scroll" ref={scrollRef} style={{ touchAction: 'pan-x pan-y' }}>
        <div
          className="floor__grid"
          style={{
            width: `${Math.round(zoom * 100)}%`,
            ['--wu' as string]: t.widthUnits,
            ['--hu' as string]: t.heightUnits,
            gridTemplateColumns: t.columns,
            gridTemplateRows: t.rows,
            fontSize: `${(zoom * 21) / t.widthUnits}vw`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
