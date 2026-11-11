import { useState, type ReactNode } from 'react';
import { gridTracks, type GridItem } from './grid';

const ZOOMS = [1, 1.5, 2];
// Row height relative to column width is set in CSS (--rr): shorter in landscape, taller in portrait.

/** Scalable floor-plan grid. Children are positioned with grid-column/grid-row. */
export function Floor({ items, children }: { items: GridItem[]; children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const t = gridTracks(items);
  return (
    <div className="floor">
      <div className="floor__zoom" role="group" aria-label="Priblíženie">
        {ZOOMS.map((z) => (
          <button key={z} className={`chip ${zoom === z ? 'chip--on' : ''}`} onClick={() => setZoom(z)}>
            {z * 100} %
          </button>
        ))}
      </div>
      <div className="floor__scroll">
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
