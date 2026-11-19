/* Design elements of the Mühlbauer corporate design manual: logos, hexagons and the graphic bar. */
import mpsText from '../assets/brand/mps-text.png';
import mpsTextDark from '../assets/brand/mps-text-dark.png';
import muehlbauer from '../assets/brand/muehlbauer.png';
import muehlbauerDark from '../assets/brand/muehlbauer-dark.png';
import { useEffect, useRef } from 'react';
import { hexAt } from './mpsSpin';

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

const MPS_COLORS = ['#f07632', '#008998', '#a7ccd7']; // orange, turquoise, light blue
const SPIN_MS = 1800;
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Mühlbauer Parts & Systems – the company logo. The hexagons are drawn here (the lettering is an image)
 * so they can move: each time the logo appears (a shift picked, back to the shift choice) the group
 * turns once about its middle on its tilted plane – each hexagon moves on to the next place and takes
 * its size there (see mpsSpin). `still` (the PDF) leaves it at rest.
 */
export function MpsLogo({ className = '', still = false }: { className?: string; still?: boolean }) {
  const polys = useRef<(SVGPolygonElement | null)[]>([]);
  useEffect(() => {
    if (still || reducedMotion() || typeof requestAnimationFrame !== 'function') return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / SPIN_MS);
      polys.current.forEach((el, i) => el?.setAttribute('points', hexAt(i, ease(t))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [still]);
  return (
    <span className={`logo mps-logo ${className}`} role="img" aria-label="MPS – Mühlbauer Parts and Systems">
      <svg className="mps-logo__mark" viewBox="0 0 431 638" aria-hidden="true">
        {MPS_COLORS.map((color, i) => (
          <polygon key={color} ref={(el) => { polys.current[i] = el; }} points={hexAt(i, 0)} fill={color} />
        ))}
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
