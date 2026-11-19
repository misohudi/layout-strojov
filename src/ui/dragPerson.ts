import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Dragging a person onto a machine, like the little man in Google Maps: the person's badge lifts off
 * above the finger (a small shadow marks the spot under it), a see-through sheet it came from turns
 * almost invisible so the plan shows, and the machine under the finger lights up.
 *
 * - From a sheet (the people list) the badge is held for a moment and then dragged; let go on a machine
 *   and the person is placed there, anywhere else and the badge flies back to the sheet. Moving the
 *   finger before that scrolls the list.
 * - From a machine on the plan the person is picked up by holding the machine for a moment; let go on
 *   another machine and the person moves there, anywhere else and the person is taken off the machine.
 *
 * A tap without moving / holding stays a normal tap.
 */

/** Movement (px) before a press turns into a drag – below it, it is a tap. */
const DRAG_PX = 8;
/** Holding a machine this long picks its person up. */
const HOLD_MS = 450;
/** A badge in a sheet comes off after a shorter hold (moving before it scrolls the list). */
const HOLD_SHEET_MS = 300;
/** The badge rides this far above the finger, so the finger doesn't cover it. */
const LIFT_PX = 52;

interface Drag {
  personId: string;
  /** The machine the person was picked up from (plan only). */
  from?: string;
  pointerId: number;
  startX: number;
  startY: number;
  source: HTMLElement;
  /** Badge to clone for the ghost (the sheet's badge, or one made for a person on the plan). */
  look: () => HTMLElement;
  ghost: HTMLElement | null;
  shadow: HTMLElement | null;
  target: HTMLElement | null;
  hold?: ReturnType<typeof setTimeout>;
}

export interface DropHandlers {
  /** The person let go on a machine (`from`: the machine it was picked up from on the plan). */
  place(personId: string, machineId: string, from?: string): unknown;
  /** Picked up from the plan and let go beside the machines: taken off its machine. */
  discard?(personId: string, from: string): unknown;
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

const at = (x: number, y: number, scale = 1) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;
function place(el: HTMLElement, x: number, y: number) {
  el.style.transform = at(x, y);
}

/** While a person hangs on the finger the page must not scroll or zoom under it. */
const noScroll = (e: TouchEvent) => {
  if (e.cancelable) e.preventDefault();
};

/**
 * A drag just ended: the click the browser sends right after it must not act. It holds until the next
 * press starts (a new tap is a real tap again), at most a moment.
 */
let lastDragEnd = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => (lastDragEnd = 0), { capture: true });
}
/** True right after a drag – taps (sheet backdrop, machine, plan) ignore that click. */
export const justDropped = () => Date.now() - lastDragEnd < 600;

/** A badge for a person picked up from the plan (looks like the people list's badges). */
function badge(name: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'person person--drag person--on';
  el.textContent = name;
  return el;
}

export function usePersonDrag(on: DropHandlers | ((personId: string, machineId: string) => unknown)) {
  const handlers: DropHandlers = typeof on === 'function' ? { place: on } : on;
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  function start(d: Drag, x: number, y: number) {
    const ghost = d.look().cloneNode(true) as HTMLElement;
    ghost.classList.add('drag-ghost');
    ghost.removeAttribute('id');
    ghost.setAttribute('aria-hidden', 'true');
    const shadow = document.createElement('div');
    shadow.className = 'drag-shadow';
    document.body.append(shadow, ghost);
    d.ghost = ghost;
    d.shadow = shadow;
    place(ghost, x, y - LIFT_PX);
    place(shadow, x, y);
    // the badge lifts off
    animate(ghost, [{ transform: at(x, y) }, { transform: at(x, y - LIFT_PX, 1.15) }], { duration: 160, easing: 'ease-out' });
    document.body.classList.add('is-dragging-person');
    document.addEventListener('touchmove', noScroll, { passive: false });
    d.source.classList.add('drag-source');
    try {
      d.source.setPointerCapture?.(d.pointerId); // keep getting the moves even off the badge / machine
    } catch {
      // not an active pointer (e.g. a synthetic one) – the moves still arrive while over the page
    }
    navigator.vibrate?.(15);
    setDragging(true);
  }

  function setTarget(d: Drag, t: HTMLElement | null) {
    // the machine the person came from is no target
    const next = t && t.dataset.machineId !== d.from ? t : null;
    if (d.target === next) return;
    d.target?.classList.remove('tile--drop');
    next?.classList.add('tile--drop');
    d.target = next;
  }

  function finish(d: Drag, x: number, y: number, cancelled: boolean) {
    lastDragEnd = Date.now();
    document.body.classList.remove('is-dragging-person');
    document.removeEventListener('touchmove', noScroll);
    d.source.classList.remove('drag-source');
    const target = cancelled ? null : d.target;
    setTarget(d, null);
    const ghost = d.ghost!;
    d.shadow!.remove();
    const from = at(x, y - LIFT_PX, 1.15);
    const gone = () => ghost.remove();
    const overOwn = !cancelled && tileAt(x, y)?.dataset.machineId === d.from;
    if (target) {
      // drops onto the machine: down to its middle, shrinking into it
      const r = target.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      animate(
        ghost,
        [
          { transform: from, opacity: 1 },
          { transform: at(cx, cy, 0.9), opacity: 1, offset: 0.7 },
          { transform: at(cx, cy, 0.4), opacity: 0 },
        ],
        { duration: 260, easing: 'ease-in', fill: 'forwards' },
        gone,
      );
      target.classList.add('tile--dropped');
      setTimeout(() => target.classList.remove('tile--dropped'), 500);
      void handlers.place(d.personId, target.dataset.machineId!, d.from);
    } else if (d.from && handlers.discard && !cancelled && !overOwn) {
      // thrown away beside the machines: falls and fades on the spot
      animate(
        ghost,
        [{ transform: from, opacity: 1 }, { transform: at(x, y + 20, 0.5), opacity: 0 }],
        { duration: 280, easing: 'ease-in', fill: 'forwards' },
        gone,
      );
      void handlers.discard(d.personId, d.from);
    } else {
      // missed (or let go on its own machine): flies back where it came from
      const r = d.source.getBoundingClientRect();
      animate(
        ghost,
        [{ transform: from }, { transform: at(r.left + r.width / 2, r.top + r.height / 2) }],
        { duration: 320, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)', fill: 'forwards' },
        gone,
      );
    }
    setDragging(false);
  }

  function move(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_PX) return;
      // only holding picks a person up – moving first is scrolling (the plan or the list)
      clearTimeout(d.hold);
      drag.current = null;
      return;
    }
    place(d.ghost!, e.clientX, e.clientY - LIFT_PX);
    place(d.shadow!, e.clientX, e.clientY);
    setTarget(d, tileAt(e.clientX, e.clientY));
  }

  function up(e: ReactPointerEvent<HTMLElement>, cancelled: boolean) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    clearTimeout(d.hold);
    drag.current = null;
    if (d.ghost) finish(d, e.clientX, e.clientY, cancelled);
  }

  const common = {
    onPointerMove: move,
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => up(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => up(e, true),
    onClickCapture(e: ReactMouseEvent) {
      if (justDropped()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };

  /** Waits for the hold, then the person comes off onto the finger. */
  function press(d: Drag, ms: number) {
    d.hold = setTimeout(() => {
      if (drag.current === d && !d.ghost) start(d, d.startX, d.startY);
    }, ms);
    drag.current = d;
  }

  /** A person's badge in a sheet: held for a moment = dragged. */
  const bind = (personId: string) => ({
    ...common,
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      const source = e.currentTarget;
      press({
        personId, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
        source, look: () => source, ghost: null, shadow: null, target: null,
      }, HOLD_SHEET_MS);
    },
    onContextMenu(e: ReactMouseEvent) {
      e.preventDefault(); // holding must not open the browser's menu
    },
  });

  /** A machine on the plan with a person on it: held for a moment = that person picked up. */
  const bindHold = (machineId: string, personId: string | undefined, name: string) => ({
    ...common,
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button !== 0 || !personId) return;
      const source = e.currentTarget;
      press({
        personId, from: machineId, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
        source, look: () => badge(name), ghost: null, shadow: null, target: null,
      }, HOLD_MS);
    },
    onContextMenu(e: ReactMouseEvent) {
      if (personId) e.preventDefault(); // holding must not open the browser's menu
    },
  });

  return { bind, bindHold, dragging };
}
