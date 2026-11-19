import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Speed of the back-and-forth scroll, in pixels per second. */
const SPEED = 25;

/**
 * Single-line text that does not fit: instead of "…" it slowly scrolls left and back.
 * Text that fits stays still.
 */
export function ScrollText({ text, className = '' }: { text: string; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const over = i.scrollWidth - o.clientWidth;
      setShift(over > 1 ? Math.ceil(over) : 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // the tile resizes with zoom and with the badges next to the name
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [text]);

  const style = shift
    ? ({
        '--scroll-shift': `-${shift}px`,
        // pauses at both ends are part of the keyframes, so add them to the travel time
        '--scroll-time': `${Math.max(2, shift / SPEED) * 1.5}s`,
      } as CSSProperties)
    : undefined;

  return (
    <span ref={outer} className={`scroll-text ${shift ? 'scroll-text--on' : ''} ${className}`} style={style}>
      <span ref={inner} className="scroll-text__inner">{text}</span>
    </span>
  );
}
