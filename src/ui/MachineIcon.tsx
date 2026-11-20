import type { MachineKind } from '../domain/types';

/**
 * CNC machine icons from the supplied catalogue (outline machining centre or slant-bed lathe in 3/4 view):
 * - no one on the machine: the machine alone;
 * - frézar: a standing operator at the control panel;
 * - operátor: a seated operator in front of the machine;
 * - out of service: the machine in grey with a minus sign.
 * Lines use `currentColor` (the tile's text colour); fills and the thin cut-out around the figure use
 * `--icon-bg` (the tile's background), so the icon reads on grey, blue and red tiles alike.
 */

export type IconFigure = 'none' | 'frezar' | 'operator' | 'oos';

const SW = 2.5;
const INK = 'currentColor';
const BG = 'var(--icon-bg, #fff)';
const line = { stroke: INK, strokeWidth: SW, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Machine({ dx }: { dx: number }) {
  return (
    <g transform={dx ? `translate(${dx}, 0)` : undefined}>
      {/* spindle motor cover */}
      <path d="M41 23.5L41 15C41 13.5 42 12.5 43.5 12L49 11L64.5 12.5C66 12.7 67 13.8 67 15.2L67 23.5Z" fill={BG} {...line} />
      <line x1="49" y1="11" x2="49" y2="23.5" {...line} />
      {/* machine body in 3/4 view */}
      <path
        d="M31.5 23.5L26 23.5L15.5 29C14 30 13.5 31.8 13.5 34L13.5 86C13.5 88 14.5 89.5 16.5 90.5L31.5 99.5L44.5 98L46.5 90.5L59.5 89.5L59.5 96L71.5 95L73.5 87.5L82.5 86.5C85.5 86 87.5 84 87.5 80.5L87.5 28C87.5 25 85.5 23.5 82.5 23.5L31.5 23.5Z"
        fill={BG}
        {...line}
      />
      <line x1="31.5" y1="23.5" x2="31.5" y2="99.5" {...line} />
      {/* window of the working area */}
      <rect x="36.5" y="29" width="41.5" height="44.5" rx="4" fill={BG} {...line} />
      {/* spindle head, tool, stepped table */}
      <path d="M42 29L42 45.5L51 51L51 54.5L61 54.5L61 51L64 49L64 29Z" fill={BG} {...line} />
      <line x1="49" y1="29" x2="49" y2="49.5" {...line} />
      <path d="M54 54.5L54 65.5L56 68L58 65.5L58 54.5" fill="none" {...line} />
      <line x1="54" y1="59.5" x2="58" y2="61.5" {...line} />
      <path d="M40.5 73.5L40.5 68.5L45 68.5L45 65L67.5 65L67.5 68.5L72 68.5L72 73.5" fill="none" {...line} />
      {/* control panel on its arm */}
      <path d="M87.5 79.5L95.5 79.5C98 79.5 99.5 78 99.5 75.5L99.5 66.5" fill="none" {...line} />
      <path
        d="M86 40L107.5 40C109 40 110 41 110 42.5L110 55.5L106 65C105.5 66.2 104.2 66.8 102.8 66.8L82.5 66.8C81 66.8 80.2 65.5 80.8 64L84.5 55.5L84.5 42.5C84.5 41 85.2 40 86 40Z"
        fill={BG}
        stroke={INK}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <rect x="88.5" y="44" width="17.5" height="9.5" rx="1" fill="none" stroke={INK} strokeWidth={SW} />
      <line x1="84.5" y1="56.5" x2="109.5" y2="56.5" stroke={INK} strokeWidth={SW} />
      <line x1="87.5" y1="61.5" x2="96.5" y2="61.5" {...line} />
      <line x1="101.5" y1="61.5" x2="103.5" y2="61.5" {...line} />
    </g>
  );
}

/** CNC lathe (slant-bed turning centre) – same family, size and control panel as the milling machine. */
function Lathe({ dx }: { dx: number }) {
  return (
    <g transform={dx ? `translate(${dx}, 0)` : undefined}>
      {/* headstock cover */}
      <path d="M18 24.8L18 18.5C18 16.8 19.2 15.5 21 15L28.5 13.5L49 13.5C51 13.5 52.5 15 52.5 17L52.5 21.5" fill={BG} {...line} />
      <line x1="28.5" y1="13.5" x2="28.5" y2="21.5" {...line} />
      {/* body with a slanted top and feet */}
      <path
        d="M28.5 21.5L23.5 21.5L13.5 27.5C12 28.5 11.5 30.2 11.5 32.5L11.5 85.5C11.5 87.5 12.5 89 14.5 90L28.5 98.5L42.5 97L44.5 90L61.5 89L61.5 95.5L73.5 94.5L75.5 87.5L84 86.5C86.8 86 88.5 84 88.5 80.5L88.5 31C88.5 28.5 87.2 26.8 85 25.5L77.5 21.5L28.5 21.5Z"
        fill={BG}
        {...line}
      />
      <line x1="28.5" y1="21.5" x2="28.5" y2="98.5" {...line} />
      <line x1="28.5" y1="78.5" x2="84.5" y2="76.5" {...line} />
      {/* window of the working area */}
      <path d="M35 29.5L73.5 28L80 33L80 67.5C80 69.2 78.8 70.2 77 70.3L37.5 71.8C36 71.9 35 70.8 35 69.2Z" fill={BG} {...line} />
      {/* chuck with jaws, stepped workpiece, turret with the cutting tool */}
      <path d="M35 44.5L42.5 44.2C45.2 44.2 46.8 49.2 46.8 55C46.8 60.8 45.2 65.8 42.5 65.8L35 66.1" fill="none" {...line} />
      <path d="M45.2 47.8L49.5 47.5L49.5 51.2" fill="none" {...line} />
      <path d="M45.2 62.2L49.5 61.8L49.5 58.1" fill="none" {...line} />
      <path d="M46.6 50.8L59.5 50.2C61 50.2 61.6 51.9 61.6 54.2C61.6 56.5 61 58.2 59.5 58.2L46.6 58.8" fill="none" {...line} />
      <path d="M61.1 51.7L70 51.3C71.2 51.3 71.8 52.4 71.8 53.8C71.8 55.2 71.2 56.3 70 56.3L61.1 56.7" fill="none" {...line} />
      <path d="M55.5 28.7L53.5 36.2L57.2 40.5L66.2 40.1L70 35.6L72 28.1" fill="none" {...line} />
      <line x1="61.2" y1="28.5" x2="58.7" y2="39.8" {...line} />
      <path d="M59.5 40.4L58.2 46.5L60.5 50.2L63.8 46.2L64.5 40.2" fill="none" {...line} />
      {/* control panel on its arm */}
      <path d="M88.5 79.5L96 79.5C98.5 79.5 100 78 100 75.5L100 66.8" fill="none" {...line} />
      <path
        d="M86.5 40L108 40C109.5 40 110.5 41 110.5 42.5L110.5 55.5L106.5 65C106 66.2 104.7 66.8 103.3 66.8L83 66.8C81.5 66.8 80.7 65.5 81.3 64L85 55.5L85 42.5C85 41 85.7 40 86.5 40Z"
        fill={BG}
        stroke={INK}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <rect x="89" y="44" width="17.5" height="9.5" rx="1" fill="none" stroke={INK} strokeWidth={SW} />
      <line x1="85" y1="56.5" x2="110" y2="56.5" stroke={INK} strokeWidth={SW} />
      <line x1="88" y1="61.5" x2="97" y2="61.5" {...line} />
      <line x1="102" y1="61.5" x2="104" y2="61.5" {...line} />
    </g>
  );
}

const round = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Frézar – standing at the control panel, typing. */
function Standing() {
  const torso = 'M52.5 50C52.5 45 63.5 45 65 50.5L63.5 71.2L51 69.4Z';
  const backArm = 'M62 49.5L72.5 56.5L84.5 58';
  const frontArm = 'M58 50.5L68 61.5L82.5 63.5';
  const legs =
    'M50.8 74.2L63.2 76L69.5 90.5L73.5 104.2L78.5 105.4C79.5 105.8 79.8 108 78.5 108L68.2 108L63.8 92L57.8 80.5L56 92L58 104.4L62 105.6C62.8 106 62.8 108 61.5 108L51.8 108L50 91.5Z';
  return (
    <g className="icon-figure">
      {/* thin cut-out so the figure separates from the machine */}
      <g fill={BG} stroke={BG} {...round}>
        <circle cx="62" cy="35" r="8.6" stroke="none" />
        <path d={torso} strokeWidth={4.4} />
        <path d={backArm} fill="none" strokeWidth={9.2} />
        <path d={frontArm} fill="none" strokeWidth={9.2} />
        <path d={legs} strokeWidth={4.4} />
      </g>
      <path d={backArm} fill="none" stroke={INK} strokeWidth={6.2} {...round} />
      <path d={torso} fill={INK} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <path d={frontArm} fill="none" stroke={BG} strokeWidth={9.2} {...round} />
      <path d={frontArm} fill="none" stroke={INK} strokeWidth={6.2} {...round} />
      <circle cx="62" cy="35" r="8.6" fill={BG} />
      <circle cx="62" cy="35" r="7.1" fill={INK} />
      <line x1="48.5" y1="71.8" x2="65.5" y2="73.8" stroke={BG} strokeWidth={1.5} />
      <path d={legs} fill={INK} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
    </g>
  );
}

/** Operátor – seated on a workshop stool in front of the machine. */
function Seated() {
  const torso = 'M36 52C36 47 46.5 47 48 52.5L47 72.2L35 71.2Z';
  const backArm = 'M45 52L55 59.5L65.5 59';
  const frontArm = 'M41.5 53L50.5 63L63 63';
  const legs =
    'M35 75.5L55 77C59 77.3 61 79.5 61 83.2L61 104.2L66 105.4C67 105.8 67 108 65.6 108L55 108L55 84.2L38 83.2C35.8 83 35 81.2 35 79Z';
  return (
    <g className="icon-figure">
      <g fill={BG} stroke={BG} {...round}>
        <circle cx="45" cy="38" r="8.4" stroke="none" />
        <path d={torso} strokeWidth={4.4} />
        <path d={backArm} fill="none" strokeWidth={9} />
        <path d={frontArm} fill="none" strokeWidth={9} />
        <path d={legs} strokeWidth={4.4} />
        <rect x="32.5" y="85" width="16" height="3.5" rx="1.75" strokeWidth={4.4} />
        <line x1="40.5" y1="88" x2="40.5" y2="108.5" strokeWidth={5.5} />
        <line x1="35" y1="97.5" x2="46" y2="97.5" strokeWidth={5.5} />
        <path d="M31.5 108.5L40.5 103.5L49.5 108.5" fill="none" strokeWidth={5.5} />
      </g>
      {/* stool */}
      <path d="M31.5 108.5L40.5 103.5L49.5 108.5" fill="none" stroke={INK} strokeWidth={SW} {...round} />
      <line x1="40.5" y1="87.5" x2="40.5" y2="108.5" stroke={INK} strokeWidth={SW} strokeLinecap="round" />
      <line x1="35" y1="97.5" x2="46" y2="97.5" stroke={INK} strokeWidth={SW} strokeLinecap="round" />
      <rect x="32.5" y="85" width="16" height="3.5" rx="1.75" fill={INK} stroke={INK} strokeWidth={0.84} />
      <path d={backArm} fill="none" stroke={INK} strokeWidth={6} {...round} />
      <path d={torso} fill={INK} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <path d={frontArm} fill="none" stroke={BG} strokeWidth={9} {...round} />
      <path d={frontArm} fill="none" stroke={INK} strokeWidth={6} {...round} />
      <circle cx="45" cy="38" r="8.4" fill={BG} />
      <circle cx="45" cy="38" r="6.9" fill={INK} />
      <line x1="33" y1="73.5" x2="49.5" y2="74.7" stroke={BG} strokeWidth={1.5} />
      <path d={legs} fill={INK} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
    </g>
  );
}

export function MachineIcon({ figure, kind = 'mill' }: { figure: IconFigure; kind?: MachineKind }) {
  const Body = kind === 'lathe' ? Lathe : Machine;
  return (
    <svg
      className="tile__icon"
      viewBox="0 0 120 116"
      fill="none"
      aria-hidden="true"
      data-testid={`icon-${figure === 'none' ? 'machine' : figure}`}
      data-kind={kind}
    >
      <Body dx={figure === 'frezar' ? -6 : 0} />
      {figure === 'frezar' && <Standing />}
      {figure === 'operator' && <Seated />}
      {figure === 'oos' && (
        <g>
          {/* minus in a circle, top right */}
          <circle cx="102" cy="17" r="15" fill={BG} stroke={INK} strokeWidth={SW + 0.5} />
          <line x1="94" y1="17" x2="110" y2="17" stroke={INK} strokeWidth={SW + 1.5} strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
