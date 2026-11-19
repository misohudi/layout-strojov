import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Dragging a person onto a machine, like the little man in Google Maps: the person's badge lifts off
 * above the finger (a small shadow marks the spot under it), the sheet it came from turns almost
 * see-through so the plan shows, and the machine under the finger lights up. Let go on a machine and
 * the badge drops onto it; let go anywhere else and it flies back to the sheet.
 *
 * A tap without moving stays a normal tap (it opens the person as before).
 */

/** Movement (px) before a press turns into a drag – below it, it is a tap. */
const DRAG_PX = 8;
/** The badge rides this far above the finger, so the finger doesn't cover it. */
const LIFT_PX = 52;

interface Drag {
  personId: string;
  pointerId: number;
  startX: number;
  startY: number;
  source: HTMLElement;
  ghost: HTMLElement | null;
  shadow: HTMLElement | null;
  target: HTMLElement | null;
}

/** The machine tile under a point (only machines in operation). */
function tileAt(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-machine-id]');
  return el && el.dataset.machineActive === 'true' ? el : null;
}

/** Element.animate where the browser has it (not in the test DOM); `done` runs when it ends. */
function animate(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions, done?: () => void) {
  if (typeof el.animate !== 'function') {
    done?.();
    return;
  }
  const a = el.animate(frames, opts);
  if (done) {
    a.onfinish = done;
    a.oncancel = done;
  }
}

function place(el: HTMLElement, x: number, y: number) {
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}

/** When the last drag ended: the click the browser sends right after it must not close the sheet. */
let lastDragEnd = 0;
/** True for a moment after a drag – a sheet's backdrop ignores that click. */
export const justDropped = () => Date.now() - lastDragEnd < 400;

export function usePersonDrag(onPlace: (personId: string, machineId: string) => unknown) {
  const drag = useRef<Drag | null>(null);
  /** A drag just ended: swallow the click the browser sends after it. */
  const justDragged = useRef(false);
  const [dragging, setDragging] = useState(false);

  function start(d: Drag, x: number, y: number) {
    const ghost = d.source.cloneNode(true) as HTMLElement;
    ghost.className = `${d.source.className} drag-ghost`;
    ghost.removeAttribute('id');
    ghost.setAttribute('aria-hidden', 'true');
    const shadow = document.createElement('div');
    shadow.className = 'drag-shadow';
    document.body.append(shadow, ghost);
    d.ghost = ghost;
    d.shadow = shadow;
    place(ghost, x, y - LIFT_PX);
    place(shadow, x, y);
    // the badge lifts off its place in the sheet
    animate(
      ghost,
      [{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1)` }, { transform: `translate(${x}px, ${y - LIFT_PX}px) translate(-50%, -50%) scale(1.15)` }],
      { duration: 160, easing: 'ease-out' },
    );
    document.body.classList.add('is-dragging-person');
    d.source.classList.add('drag-source');
    setDragging(true);
  }

  function setTarget(d: Drag, t: HTMLElement | null) {
    if (d.target === t) return;
    d.target?.classList.remove('tile--drop');
    t?.classList.add('tile--drop');
    d.target = t;
  }

  function finish(d: Drag, x: number, y: number, cancelled: boolean) {
    lastDragEnd = Date.now();
    document.body.classList.remove('is-dragging-person');
    d.source.classList.remove('drag-source');
    const target = cancelled ? null : d.target;
    setTarget(d, null);
    const ghost = d.ghost!;
    const shadow = d.shadow!;
    shadow.remove();
    const from = `translate(${x}px, ${y - LIFT_PX}px) translate(-50%, -50%) scale(1.15)`;
    const gone = () => ghost.remove();
    if (target) {
      // drops onto the machine: down to its middle, shrinking into it
      const r = target.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      animate(
        ghost,
        [
          { transform: from, opacity: 1 },
          { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(0.9)`, opacity: 1, offset: 0.7 },
          { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(0.4)`, opacity: 0 },
        ],
        { duration: 260, easing: 'ease-in', fill: 'forwards' },
        gone,
      );
      target.classList.add('tile--dropped');
      setTimeout(() => target.classList.remove('tile--dropped'), 500);
      void onPlace(d.personId, target.dataset.machineId!);
    } else {
      // missed: flies back to its place in the sheet
      const r = d.source.getBoundingClientRect();
      animate(
        ghost,
        [
          { transform: from },
          { transform: `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px) translate(-50%, -50%) scale(1)` },
        ],
        { duration: 320, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)', fill: 'forwards' },
        gone,
      );
    }
    setDragging(false);
  }

  /** Pointer handlers for a person's badge. */
  const bind = (personId: string) => ({
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      drag.current = {
        personId, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
        source: e.currentTarget, ghost: null, shadow: null, target: null,
      };
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.pointerId !== e.pointerId) return;
      if (!d.ghost) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_PX) return;
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId); // keep getting the moves even off the badge
        } catch {
          // not an active pointer (e.g. a synthetic one) – the moves still arrive while over the page
        }
        start(d, e.clientX, e.clientY);
      }
      place(d.ghost!, e.clientX, e.clientY - LIFT_PX);
      place(d.shadow!, e.clientX, e.clientY);
      setTarget(d, tileAt(e.clientX, e.clientY));
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      const d = drag.current;
      drag.current = null;
      if (!d || d.pointerId !== e.pointerId || !d.ghost) return;
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      finish(d, e.clientX, e.clientY, false);
    },
    onPointerCancel(e: ReactPointerEvent<HTMLElement>) {
      const d = drag.current;
      drag.current = null;
      if (d?.ghost) finish(d, e.clientX, e.clientY, true);
    },
    onClickCapture(e: ReactMouseEvent) {
      if (justDragged.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  });

  return { bind, dragging };
}
