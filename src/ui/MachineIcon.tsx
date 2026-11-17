import { useId } from 'react';

/**
 * Isometric machining centre: enclosure with a door window (spindle, tool, vise and table inside),
 * spindle head on top and a control panel on an arm. With `staffed` an operator stands at the panel
 * and types on it. Drawn in `currentColor` with lighter side and top faces, so it works on every tile.
 */

type P3 = [number, number, number];

const COS = Math.cos(Math.PI / 6);
/** x runs to the right and down, y to the left and down, z up. */
const iso = ([x, y, z]: P3): [number, number] => [(x - y) * COS, (x + y) * 0.5 - z];

// ---- geometry (units) ----
const BODY = { x0: 0, x1: 24, y0: 0, y1: 15, z0: 0, z1: 27 };
const HEAD = { x0: 6, x1: 16, y0: 3, y1: 12, z0: 27, z1: 33 };
const ARM = { x0: 24, x1: 26.5, y0: 13, y1: 14.5, z0: 14, z1: 15.5 };
const PANEL = { x0: 26.5, x1: 33, y0: 13, y1: 15.5, z0: 9, z1: 19 };
const SCREEN = { x0: 27.7, x1: 31.8, z0: 13, z1: 17.6 }; // on the panel's front face
const WINDOW = { x0: 3, x1: 21, z0: 8, z1: 24 }; // on the body's front face
/** Where the operator stands (feet) and how tall the figure is (screen units). */
const FEET = iso([30, 22.5, 0]);
const PERSON_H = 20;

type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
const top = (b: Box): P3[] => [[b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]];
/** Face towards the viewer on the left (y = y1). */
const front = (b: Box): P3[] => [[b.x0, b.y1, b.z1], [b.x1, b.y1, b.z1], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0]];
/** Face towards the viewer on the right (x = x1). */
const side = (b: Box): P3[] => [[b.x1, b.y1, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0]];
const onFront = (y: number, r: { x0: number; x1: number; z0: number; z1: number }): P3[] =>
  [[r.x0, y, r.z1], [r.x1, y, r.z1], [r.x1, y, r.z0], [r.x0, y, r.z0]];

const d = (pts: P3[]) =>
  pts.map((p, i) => {
    const [x, y] = iso(p);
    return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join('') + 'Z';

// ---- operator (2D silhouette at the feet point, facing the panel) ----
const fx = FEET[0];
const fy = FEET[1];
const shoulderY = fy - PERSON_H + 6.5;
const headC: [number, number] = [fx - 0.3, fy - PERSON_H + 2.6];
const PERSON_BODY =
  `M${fx - 3.6} ${fy}` +
  `L${fx - 3.6} ${shoulderY + 2.2}` +
  `Q${fx - 3.6} ${shoulderY} ${fx - 1.2} ${shoulderY}` +
  `L${fx + 1.4} ${shoulderY}` +
  `Q${fx + 3.6} ${shoulderY} ${fx + 3.6} ${shoulderY + 2.2}` +
  `L${fx + 3.6} ${fy}Z`;
/** Arm bent at the elbow, the hand on the panel's keys below the screen – typing. */
const hand = iso([29.6, 15.5, 11.6]);
const elbow: [number, number] = [fx + 3.3, shoulderY + 5.2];
const PERSON_ARM =
  `M${fx + 2.2} ${shoulderY + 1.4}L${elbow[0].toFixed(2)} ${elbow[1].toFixed(2)}` +
  `L${hand[0].toFixed(2)} ${hand[1].toFixed(2)}`;

// ---- viewBox from all points ----
const all: [number, number][] = [
  ...[BODY, HEAD, PANEL].flatMap((b) => [...top(b), ...front(b), ...side(b)]).map(iso),
  [fx - 4.5, fy + 0.5],
  [fx + 4.5, headC[1] - 3],
];
const PAD = 1;
const minX = Math.min(...all.map((p) => p[0])) - PAD;
const minY = Math.min(...all.map((p) => p[1])) - PAD;
const maxX = Math.max(...all.map((p) => p[0])) + PAD;
const maxY = Math.max(...all.map((p) => p[1])) + PAD;
const VIEWBOX = `${minX.toFixed(2)} ${minY.toFixed(2)} ${(maxX - minX).toFixed(2)} ${(maxY - minY).toFixed(2)}`;

function Machine() {
  const fy1 = BODY.y1;
  return (
    <>
      {/* enclosure */}
      <path d={d(top(BODY))} opacity={0.45} />
      <path d={d(side(BODY))} opacity={0.7} />
      <path fillRule="evenodd" d={d(front(BODY)) + d(onFront(fy1, WINDOW))} />
      {/* inside the window: spindle, tool, vise with workpiece, table */}
      <path d={d(onFront(fy1, { x0: 11, x1: 13.5, z0: 16.5, z1: 24 }))} />
      <path d={d([[11.3, fy1, 16.5], [13.2, fy1, 16.5], [12.25, fy1, 13.5]])} />
      <path d={d(onFront(fy1, { x0: 8.5, x1: 16, z0: 11, z1: 12.8 }))} />
      <path d={d(onFront(fy1, { x0: 5, x1: 19, z0: 9, z1: 10.3 }))} />
      {/* spindle head */}
      <path d={d(top(HEAD))} opacity={0.45} />
      <path d={d(side(HEAD))} opacity={0.7} />
      <path d={d(front(HEAD))} />
      {/* control panel on its arm */}
      <path d={d(front(ARM))} />
      <path d={d(top(PANEL))} opacity={0.45} />
      <path d={d(side(PANEL))} opacity={0.7} />
      <path fillRule="evenodd" d={d(front(PANEL)) + d(onFront(PANEL.y1, SCREEN))} />
    </>
  );
}

export function MachineIcon({ staffed }: { staffed: boolean }) {
  // the operator stands in front of the machine: cut a thin outline around them out of the machine
  const id = useId();
  const maskId = staffed ? `op-mask-${id.replace(/:/g, '')}` : undefined;
  return (
    <svg
      className="tile__icon"
      viewBox={VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      data-testid={staffed ? 'icon-staffed' : 'icon-machine'}
    >
      {staffed && (
        <mask id={maskId} maskUnits="userSpaceOnUse" x={minX} y={minY} width={maxX - minX} height={maxY - minY}>
          <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="white" />
          <g fill="black" stroke="black" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round">
            <path d={PERSON_BODY} />
            <circle cx={headC[0]} cy={headC[1]} r={2.9} />
            <path d={PERSON_ARM} fill="none" strokeWidth={2.4 + 2.2} strokeLinejoin="round" />
          </g>
        </mask>
      )}
      <g mask={maskId ? `url(#${maskId})` : undefined}>
        <Machine />
      </g>
      {staffed && (
        <g>
          <path d={PERSON_BODY} />
          <circle cx={headC[0]} cy={headC[1]} r={2.9} />
          <path d={PERSON_ARM} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}
