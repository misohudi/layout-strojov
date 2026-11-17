import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { trackWeights, type GridItem } from './grid';

/** Zooming out shows more of a wide plan at once; zooming in shows details. */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
/** Pinching back to within 8 % of 100 % snaps to exactly 100 %. */
const SNAP = 0.08;

/**
 * Tile size at 100 %: the whole hall fits the screen (no scrolling on the tablet), but a tile never gets
 * smaller than a comfortable finger target – on a tiny screen the plan scrolls instead.
 */
const TILE_MIN = 64;
const TILE_H_MAX = 120;
/** Width / height: tiles are about square, a bit wider on big screens, never much narrower than high. */
const MAX_RATIO = 1.5;
const MIN_RATIO = 0.8;
const GAP = 10;

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

const clampPx = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v || 0));

/** Size of one track that fills `areaPx` with tracks of the given weights (aisles < 1), padding and gaps. */
const fit = (areaPx: number, weights: number[]) =>
  (areaPx - 2 * GAP - GAP * (weights.length - 1)) / weights.reduce((s, w) => s + w, 0);

/** Tile size at 100 % for a scroll area `areaW` × `areaH` showing the given columns and rows. */
export function tileSize(areaW: number, areaH: number, tracks: { cols: number[]; rows: number[] }) {
  let h = clampPx(fit(areaH, tracks.rows), TILE_MIN, TILE_H_MAX);
  const w = clampPx(fit(areaW, tracks.cols), TILE_MIN, h * MAX_RATIO);
  if (w < h * MIN_RATIO) h = Math.max(TILE_MIN, w / MIN_RATIO);
  return { w: Math.floor(w), h: Math.floor(h) };
}

/**
 * Floor plan of equally sized tiles that fill the screen. Should the plan not fit (tiny screen or zoomed
 * in), it pans with one finger (native scrolling of its own area); two fingers zoom around the point
 * between them. While
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
  const tracks = trackWeights(items);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const size = tileSize(area.w, area.h, tracks);
  const tileH = size.h * zoom;
  const tileW = size.w * zoom;

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
            // aisles (empty columns / rows) are narrower than machines
            gridTemplateColumns: tracks.cols.map((w) => `${Math.round(tileW * w)}px`).join(' '),
            gridTemplateRows: tracks.rows.map((w) => `${Math.round(tileH * w)}px`).join(' '),
            gap: `${Math.round(GAP * zoom)}px`,
            padding: `${Math.round(GAP * zoom)}px`,
            // texts and icon scale with the tile
            fontSize: `${(Math.min(tileW, tileH) * 0.17).toFixed(1)}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
