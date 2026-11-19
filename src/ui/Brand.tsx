/* Design elements of the Mühlbauer corporate design manual: logos, hexagons and the graphic bar. */
import mpsText from '../assets/brand/mps-text.png';
import mpsTextDark from '../assets/brand/mps-text-dark.png';
import muehlbauer from '../assets/brand/muehlbauer.png';
import muehlbauerDark from '../assets/brand/muehlbauer-dark.png';
import { useId } from 'react';

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

// The three hexagons of the MPS logo, traced from the logo artwork (same height as the lettering image).
const MPS_HEXES = [
  '2,193 41,95 148,113 227,213 214,313 100,318', // orange
  '191,26 267,45 330,124 329,197 252,191 176,97', // turquoise
  '257,227 335,233 411,318 410,419 333,436 246,326', // light blue
];
// A colour wheel behind them, centred between the hexagons (237, 216): each hexagon sits in its own
// 120°-ish slice, so at rest the logo has its normal colours.
const MPS_WHEEL = [
  { color: '#a7ccd7', d: 'M237 216L937 204A700 700 0 0 1 188 914Z' },
  { color: '#f07632', d: 'M237 216L188 914A700 700 0 0 1 -154 -364Z' },
  { color: '#008998', d: 'M237 216L-154 -364A700 700 0 0 1 937 204Z' },
];

/**
 * Mühlbauer Parts & Systems – the company logo. The hexagons are windows onto a colour wheel (the
 * lettering is an image): each time the logo appears (a shift picked, back to the shift choice) the wheel
 * makes one turn, so the colours rotate through the hexagons – turquoise becomes orange, orange light
 * blue, light blue turquoise – and stop where they started.
 */
export function MpsLogo({ className = '' }: { className?: string }) {
  const clip = `mps-clip-${useId().replace(/:/g, '')}`;
  return (
    <span className={`logo mps-logo ${className}`} role="img" aria-label="MPS – Mühlbauer Parts and Systems">
      <svg className="mps-logo__mark" viewBox="0 0 431 638" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            {MPS_HEXES.map((points) => (
              <polygon key={points} points={points} />
            ))}
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <g className="mps-wheel">
            {MPS_WHEEL.map((w) => (
              <path key={w.color} d={w.d} fill={w.color} />
            ))}
          </g>
        </g>
      </svg>
      <img className="logo__light" src={mpsText} alt="" aria-hidden="true" />
      <img className="logo__dark" src={mpsTextDark} alt="" aria-hidden="true" />
    </span>
  );
}

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
