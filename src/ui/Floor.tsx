import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { gridTracks, type GridItem } from './grid';

const ZOOMS = [1, 1.5, 2];
// Row height relative to column width is set in CSS (--rr): shorter in landscape, taller in portrait.

/**
 * Scalable floor-plan grid. The plan lives in its own scroll area so it pans freely in any
 * direction (including diagonally); the zoom buttons float above it and never scroll away.
 */
export function Floor({ items, children }: { items: GridItem[]; children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const keepCenter = useRef<{ x: number; y: number } | null>(null);
  const t = gridTracks(items);

  function changeZoom(z: number) {
    const el = scrollRef.current;
    if (el && el.scrollWidth > 0 && el.scrollHeight > 0) {
      // Remember which point of the plan is in the middle of the view, to keep it there after zooming.
      keepCenter.current = {
        x: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth,
        y: (el.scrollTop + el.clientHeight / 2) / el.scrollHeight,
      };
    }
    setZoom(z);
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const c = keepCenter.current;
    if (!el || !c) return;
    el.scrollLeft = c.x * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = c.y * el.scrollHeight - el.clientHeight / 2;
    keepCenter.current = null;
  }, [zoom]);

  return (
    <div className="floor">
      <div className="floor__zoom" role="group" aria-label="Priblíženie">
        {ZOOMS.map((z) => (
          <button key={z} className={`chip ${zoom === z ? 'chip--on' : ''}`} onClick={() => changeZoom(z)}>
            {z * 100} %
          </button>
        ))}
      </div>
      <div className="floor__scroll" data-testid="floor-scroll" ref={scrollRef} style={{ touchAction: 'pan-x pan-y' }}>
        <div
          className="floor__grid"
          style={{
            width: `${zoom * 100}%`,
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
