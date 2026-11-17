import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { gridSize, type GridItem } from './grid';

/** Zooming out shows more of a wide plan at once; zooming in shows details. */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
/** Pinching back to within 8 % of 100 % snaps to exactly 100 %. */
const SNAP = 0.08;

/** Tile height at 100 %: from the available height (all rows visible), but always readable. */
const TILE_H_MIN = 84;
const TILE_H_MAX = 104;
/** Tiles are landscape rectangles: icon on the left, texts on the right. */
const TILE_RATIO = 2.1;
const GAP = 14;

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

/** Tile height at 100 % for a scroll area `areaPx` high showing `rows` rows. */
export function tileHeight(areaPx: number, rows: number): number {
  const fit = (areaPx - 2 * GAP - GAP * (rows - 1)) / rows;
  return Math.round(Math.min(TILE_H_MAX, Math.max(TILE_H_MIN, fit || 0)));
}

/**
 * Floor plan of equally sized landscape tiles. Rows wider than the screen pan sideways with one
 * finger (native scrolling of its own area); two fingers zoom around the point between them. While
 * zoomed, a semi-transparent "100 %" button in the top-right corner returns to the normal size.
 */
export function Floor({
  items,
  children,
  onPlanClick,
}: {
  items: GridItem[];
  children: ReactNode;
  /** Any tap inside the plan area (machines included – the handler filters). */
  onPlanClick?(e: MouseEvent): void;
}) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinch = useRef<Pinch | null>(null);
  /** Scroll position to restore after the zoom re-renders, keeping the focal point under the fingers. */
  const anchor = useRef<{ fx: number; fy: number; x: number; y: number } | null>(null);
  const size = gridSize(items);
  const [areaH, setAreaH] = useState(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setAreaH(el.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tileH = tileHeight(areaH, size.rows) * zoom;

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
      if (Math.abs(zoomRef.current - 1) < SNAP && zoomRef.current !== 1) applyZoom(1);
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
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }

  return (
    <div className="floor">
      {zoom !== 1 && (
        <button className="floor__reset" aria-label="Späť na 100 %" onClick={reset}>
          100 %
        </button>
      )}
      <div
        className="floor__scroll"
        data-testid="floor-scroll"
        ref={scrollRef}
        style={{ touchAction: 'pan-x pan-y' }}
        onClick={onPlanClick}
      >
        <div
          className="floor__grid"
          data-zoom={zoom}
          style={{
            gridTemplateColumns: `repeat(${size.cols}, ${Math.round(tileH * TILE_RATIO)}px)`,
            gridTemplateRows: `repeat(${size.rows}, ${Math.round(tileH)}px)`,
            gap: `${Math.round(GAP * zoom)}px`,
            padding: `${Math.round(GAP * zoom)}px`,
            // texts and icon scale with the tile
            fontSize: `${(tileH * 0.135).toFixed(1)}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
