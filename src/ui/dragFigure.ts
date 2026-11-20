/**
 * Drag & drop operator: the figure hanging from the finger / cursor while a person is dragged.
 *
 * Same style as the figures on the machine tiles: a solid pictogram in `currentColor`, separated
 * from whatever is under it by a cut-out in `--icon-bg`. The cut-out is drawn with a non-scaling
 * stroke, so it is always 1.5 px on screen, whatever size the icon is shown at.
 *
 * No imports: the generator script (scripts/drag-icons.ts) runs this file directly with Node.
 */

export type DragPose = 'hang' | 'swing-left' | 'swing-right' | 'drop';

export const DRAG_POSES: { pose: DragPose; label: string }[] = [
  { pose: 'hang', label: 'Visí' },
  { pose: 'swing-left', label: 'Ťah doľava' },
  { pose: 'swing-right', label: 'Ťah doprava' },
  { pose: 'drop', label: 'Nad cieľom' },
];

/** The cut-out: 3 px stroke centred on the edge = 1.5 px outside the figure. */
export const CUT_PX = 1.5;

type Pt = readonly [number, number];

/** Where the finger / cursor holds the figure (the hands). */
const GRIP: Pt = [32, 5];
const HIP: Pt = [32, 43];

const f = (n: number) => +n.toFixed(2);

/** A limb segment as a filled capsule (round ends), so it can carry the non-scaling cut-out. */
function capsule(a: Pt, b: Pt, r: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * r;
  const ny = (dx / len) * r;
  const p = (x: number, y: number) => `${f(x)} ${f(y)}`;
  return (
    `M${p(a[0] + nx, a[1] + ny)}L${p(b[0] + nx, b[1] + ny)}` +
    `A${r} ${r} 0 0 0 ${p(b[0] - nx, b[1] - ny)}` +
    `L${p(a[0] - nx, a[1] - ny)}A${r} ${r} 0 0 0 ${p(a[0] + nx, a[1] + ny)}Z`
  );
}

/** A bent limb: one capsule per segment (they overlap at the joints). */
const limb = (pts: Pt[], r: number) => pts.slice(1).map((b, i) => capsule(pts[i], b, r));

interface Part {
  /** Filled shapes of one body part; their cut-outs are drawn together, before the fills. */
  d: string[];
}

function figure(pose: DragPose): { body: Part[]; legs: Part[]; legTurn: number; bodyTurn: number; marker: boolean } {
  const arms: Part = {
    d: [
      ...limb([[27, 28.5], [24.6, 17.5], [29, 6.5]], 2.5),
      ...limb([[37, 28.5], [39.4, 17.5], [35, 6.5]], 2.5),
    ],
  };
  const torso: Part = { d: ['M25.8 30.2C25.8 26.2 38.2 26.2 38.2 30.2L37 43.4L27 43.4Z'] };
  const head: Part = { d: ['M32 15.2a5.9 5.9 0 1 1 0 11.8a5.9 5.9 0 1 1 0-11.8Z'] };
  // dangling legs, knees a little bent; over a target they hang straight down, ready to land.
  // Each leg is its own part, so the cut-out separates them even where they touch.
  const legs: Part[] =
    pose === 'drop'
      ? [{ d: limb([[29.4, 45.5], [29.2, 59]], 2.9) }, { d: limb([[34.6, 45.5], [34.8, 59]], 2.9) }]
      : [
          { d: limb([[29.4, 45.5], [27.8, 52.8], [28.9, 59.5]], 2.9) },
          { d: limb([[34.6, 45.5], [36.4, 52.4], [35.3, 59]], 2.9) },
        ];
  // moving sideways the body trails behind the hands and the legs swing a bit further
  const bodyTurn = pose === 'swing-left' ? -13 : pose === 'swing-right' ? 13 : 0;
  const legTurn = pose === 'swing-left' ? -9 : pose === 'swing-right' ? 9 : 0;
  return { body: [torso, arms, head], legs, legTurn, bodyTurn, marker: pose === 'drop' };
}

const INK = 'currentColor';
const BG = 'var(--icon-bg, #fff)';

function drawParts(parts: Part[]): string {
  return parts
    .map(
      (p) =>
        // cut-out of the whole part first, then the part itself, so pieces of one limb join smoothly
        p.d.map((d) => `<path d="${d}" fill="${BG}" stroke="${BG}" stroke-width="${CUT_PX * 2}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join('') +
        p.d.map((d) => `<path d="${d}" fill="${INK}"/>`).join(''),
    )
    .join('');
}

/** The icon as an SVG string (64 × 64), for files and for inline use. */
export function dragFigureSvg(pose: DragPose, opts: { size?: number; title?: string } = {}): string {
  const { body, legs, legTurn, bodyTurn, marker } = figure(pose);
  const size = opts.size ?? 64;
  const title = opts.title ? `<title>${opts.title}</title>` : '';
  const legsSvg = `<g transform="rotate(${legTurn} ${HIP[0]} ${HIP[1]})">${drawParts(legs)}</g>`;
  // landing spot under the feet: the person can be dropped here
  const landing = marker
    ? `<ellipse cx="32" cy="61.6" rx="9" ry="1.9" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="2.4 1.8"/>`
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" ` +
    `data-pose="${pose}"${opts.title ? ' role="img"' : ' aria-hidden="true"'}>` +
    title +
    landing +
    `<g transform="rotate(${bodyTurn} ${GRIP[0]} ${GRIP[1]})">${legsSvg}${drawParts(body)}</g>` +
    `</svg>`
  );
}
