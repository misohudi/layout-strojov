/* Design elements of the Mühlbauer corporate design manual: logos, hexagons and the graphic bar. */
import mps from '../assets/brand/mps.png';
import mpsDark from '../assets/brand/mps-dark.png';
import muehlbauer from '../assets/brand/muehlbauer.png';
import muehlbauerDark from '../assets/brand/muehlbauer-dark.png';

/** Points of a flat-topped hexagon around (cx, cy) with corner radius r. */
function hexPoints(cx: number, cy: number, r: number): string {
  const h = r * 0.866;
  return [
    [cx - r, cy],
    [cx - r / 2, cy - h],
    [cx + r / 2, cy - h],
    [cx + r, cy],
    [cx + r / 2, cy + h],
    [cx - r / 2, cy + h],
  ]
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
}

/** A logo in its normal and its dark-background version; CSS shows the one that fits the theme. */
function ThemedLogo({ light, dark, alt, className }: { light: string; dark: string; alt: string; className: string }) {
  return (
    <span className={`logo ${className}`}>
      <img className="logo__light" src={light} alt={alt} />
      <img className="logo__dark" src={dark} alt="" aria-hidden="true" />
    </span>
  );
}

/** Mühlbauer Parts & Systems – the company logo. */
export const MpsLogo = ({ className = '' }: { className?: string }) => (
  <ThemedLogo light={mps} dark={mpsDark} alt="MPS – Mühlbauer Parts and Systems" className={className} />
);

/** Mühlbauer Group – "High Tech International". */
export const MuehlbauerLogo = ({ className = '' }: { className?: string }) => (
  <ThemedLogo light={muehlbauer} dark={muehlbauerDark} alt="Mühlbauer High Tech International" className={className} />
);


/** Three outlined hexagons (orange, light and dark turquoise) – the corner mark before the legend. */
export function HexOutlines({ className = '' }: { className?: string }) {
  const hex = (cx: number, cy: number) => hexPoints(cx, cy, 100);
  return (
    <svg className={className} viewBox="0 0 410 410" aria-hidden="true">
      <g fill="none" strokeWidth={14} strokeLinejoin="round">
        <polygon points={hex(117, 108)} style={{ stroke: 'var(--mb-orange)' }} />
        <polygon points={hex(117, 304)} style={{ stroke: 'var(--mb-600)' }} />
        <polygon points={hex(295, 206)} style={{ stroke: '#8bc0c7' }} />
      </g>
    </svg>
  );
}
