import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { dragFigureSvg, type DragPose } from './dragFigure';

/**
 * Dragging a person onto a machine: the operator figure hangs from the finger / cursor holding the
 * person's name, a small shadow marks the spot it will land on, a see-through sheet it came from turns
 * almost invisible so the plan shows, and the machine under the finger lights up. Moving sideways the
 * figure swings; over a machine it gets ready to land.
 *
 * - From a sheet (the people list): with a mouse the badge is simply dragged; with a finger it is held
 *   for a moment first (moving at once scrolls the list). Let go on a machine and the person is placed
 *   there, anywhere else and the badge flies back to the sheet.
 * - From a machine on the plan the person is picked up by holding the machine for a moment (finger) or
 *   by dragging it (mouse); let go on another machine and the person moves there, anywhere else and the
 *   person is taken off the machine.
 *
 * A tap without moving / holding stays a normal tap.
 *
 * The moves are followed on the whole window, not only over the badge: a mouse leaves the badge at once,
 * and the badge's sheet may change under the finger.
 */

/** Movement (px) before a press turns into a drag (mouse) or a scroll (finger) – below it, it is a tap. */
const DRAG_PX = 8;
/** Holding a machine this long picks its person up (finger). */
const HOLD_MS = 450;
/** A badge in a sheet comes off after a shorter hold (finger; moving before it scrolls the list). */
const HOLD_SHEET_MS = 300;
/** The figure's feet stay this far above the finger, so the finger doesn't cover it. */
const LIFT_PX = 14;
/** Sideways speed (px/ms) from which the hanging figure swings. */
const SWING_SPEED = 0.25;

interface Drag {
  personId: string;
  /** The machine the person was picked up from (plan only). */
  from?: string;
  pointerId: number;
  /** A mouse drags at once; a finger has to hold first. */
  mouse: boolean;
  startX: number;
  startY: number;
  source: HTMLElement;
  /** Name badge to clone for the ghost (the sheet's badge, or one made for a person on the plan). */
  look: () => HTMLElement;
  ghost: HTMLElement | null;
  figure: HTMLElement | null;
  shadow: HTMLElement | null;
  target: HTMLElement | null;
  pose: DragPose;
  /** Last point and time, for the swing. */
  last: { x: number; t: number; vx: number };
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
  const el = document.elementFromPoint?.(x, y)?.closest<HTMLElement>('[data-machine-id]');
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

/** Centre of an element at a point. */
const at = (x: number, y: number, scale = 1) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;
/** Bottom centre of the ghost (the figure's feet) at a point. */
const feetAt = (x: number, y: number, scale = 1) => `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`;

/**
 * While a person hangs on the finger the page must not scroll or zoom under it. The listener is there
 * from the start: a browser decides when a touch begins whether the page may stop it scrolling, so a
 * listener added only once the drag starts comes too late (the touch scrolls and the drag is cancelled).
 */
let active = 0;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'touchmove',
    (e) => {
      if (active && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
}

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
  // the latest handlers, also for a drag that started before the last render
  const handlersRef = useRef<DropHandlers>({ place: () => {} });
  handlersRef.current = typeof on === 'function' ? { place: on } : on;
  const drag = useRef<Drag | null>(null);
  /** Stops following the window once the press is over (kept across renders). */
  const unlisten = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState(false);

  function setPose(d: Drag, pose: DragPose) {
    if (d.pose === pose || !d.figure) return;
    d.pose = pose;
    d.figure.innerHTML = dragFigureSvg(pose, { size: 48 });
  }

  function start(d: Drag, x: number, y: number) {
    if (!d.source.isConnected) return; // the sheet went away meanwhile
    const name = d.look().cloneNode(true) as HTMLElement;
    name.classList.add('drag-ghost__name');
    name.classList.remove('drag-source');
    name.removeAttribute('id');
    const figure = document.createElement('span');
    figure.className = 'drag-ghost__figure';
    figure.innerHTML = dragFigureSvg('hang', { size: 48 });
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.append(name, figure);
    const shadow = document.createElement('div');
    shadow.className = 'drag-shadow';
    document.body.append(shadow, ghost);
    d.ghost = ghost;
    d.figure = figure;
    d.shadow = shadow;
    ghost.style.transform = feetAt(x, y - LIFT_PX);
    shadow.style.transform = at(x, y);
    // the person lifts off
    animate(ghost, [{ transform: feetAt(x, y, 0.6) }, { transform: feetAt(x, y - LIFT_PX) }], { duration: 160, easing: 'ease-out' });
    document.body.classList.add('is-dragging-person');
    active++;
    d.source.classList.add('drag-source');
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
    active = Math.max(0, active - 1);
    d.source.classList.remove('drag-source');
    const target = cancelled ? null : d.target;
    setTarget(d, null);
    const ghost = d.ghost!;
    d.shadow!.remove();
    const from = feetAt(x, y - LIFT_PX);
    const gone = () => ghost.remove();
    const overOwn = !cancelled && tileAt(x, y)?.dataset.machineId === d.from;
    if (target) {
      // lands on the machine: down into its middle, shrinking into it
      const r = target.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      animate(
        ghost,
        [
          { transform: from, opacity: 1 },
          { transform: feetAt(cx, cy, 0.9), opacity: 1, offset: 0.7 },
          { transform: feetAt(cx, cy, 0.4), opacity: 0 },
        ],
        { duration: 260, easing: 'ease-in', fill: 'forwards' },
        gone,
      );
      target.classList.add('tile--dropped');
      setTimeout(() => target.classList.remove('tile--dropped'), 500);
      void handlersRef.current.place(d.personId, target.dataset.machineId!, d.from);
    } else if (d.from && handlersRef.current.discard && !cancelled && !overOwn) {
      // thrown away beside the machines: falls and fades on the spot
      animate(
        ghost,
        [{ transform: from, opacity: 1 }, { transform: feetAt(x, y + 20, 0.5), opacity: 0 }],
        { duration: 280, easing: 'ease-in', fill: 'forwards' },
        gone,
      );
      void handlersRef.current.discard(d.personId, d.from);
    } else if (d.source.isConnected) {
      // missed (or let go on its own machine): flies back where it came from
      const r = d.source.getBoundingClientRect();
      animate(
        ghost,
        [{ transform: from }, { transform: feetAt(r.left + r.width / 2, r.top + r.height / 2, 0.6), opacity: 0 }],
        { duration: 320, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)', fill: 'forwards' },
        gone,
      );
    } else {
      gone();
    }
    setDragging(false);
  }

  function follow(d: Drag, x: number, y: number) {
    const now = performance.now();
    const dt = Math.max(1, now - d.last.t);
    // smoothed sideways speed: the figure swings against the direction it is carried
    d.last = { x, t: now, vx: d.last.vx * 0.6 + ((x - d.last.x) / dt) * 0.4 };
    d.ghost!.style.transform = feetAt(x, y - LIFT_PX);
    d.shadow!.style.transform = at(x, y);
    setTarget(d, tileAt(x, y));
    setPose(d, d.target ? 'drop' : d.last.vx < -SWING_SPEED ? 'swing-left' : d.last.vx > SWING_SPEED ? 'swing-right' : 'hang');
  }

  function end(d: Drag) {
    clearTimeout(d.hold);
    if (drag.current === d) drag.current = null;
    unlisten.current?.();
    unlisten.current = null;
  }

  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_PX) return;
      if (d.mouse) {
        start(d, e.clientX, e.clientY); // a mouse just drags
        if (!d.ghost) return end(d);
      } else {
        // a finger moving before the hold is scrolling (the plan or the list)
        return end(d);
      }
    }
    if (e.cancelable) e.preventDefault(); // no text selection with a mouse
    follow(d, e.clientX, e.clientY);
  }

  function onUp(e: PointerEvent, cancelled: boolean) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    end(d);
    if (d.ghost) finish(d, e.clientX, e.clientY, cancelled);
  }

  function listen() {
    const move = (e: PointerEvent) => onMove(e);
    const up = (e: PointerEvent) => onUp(e, false);
    const cancel = (e: PointerEvent) => onUp(e, true);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    unlisten.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }

  /** A press: a finger waits for the hold, then the person comes off; a mouse waits for a move. */
  function press(d: Drag, ms: number) {
    if (drag.current) end(drag.current);
    drag.current = d;
    listen();
    if (!d.mouse) {
      d.hold = setTimeout(() => {
        if (drag.current === d && !d.ghost) {
          start(d, d.startX, d.startY);
          if (!d.ghost) end(d);
        }
      }, ms);
    }
  }

  const blockClickAfterDrop = {
    onClickCapture(e: ReactMouseEvent) {
      if (justDropped()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };

  function newDrag(e: ReactPointerEvent<HTMLElement>, personId: string, look: () => HTMLElement, from?: string): Drag {
    return {
      personId, from, pointerId: e.pointerId, mouse: e.pointerType === 'mouse',
      startX: e.clientX, startY: e.clientY, source: e.currentTarget, look,
      ghost: null, figure: null, shadow: null, target: null, pose: 'hang',
      last: { x: e.clientX, t: performance.now(), vx: 0 },
    };
  }

  /** A person's badge in a sheet: dragged (mouse) or held for a moment and dragged (finger). */
  const bind = (personId: string) => ({
    ...blockClickAfterDrop,
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      const source = e.currentTarget;
      press(newDrag(e, personId, () => source), HOLD_SHEET_MS);
    },
    onContextMenu(e: ReactMouseEvent) {
      e.preventDefault(); // holding must not open the browser's menu
    },
  });

  /** A machine on the plan with a person on it: held for a moment (finger) or dragged (mouse). */
  const bindHold = (machineId: string, personId: string | undefined, name: string) => ({
    ...blockClickAfterDrop,
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button !== 0 || !personId) return;
      press(newDrag(e, personId, () => badge(name), machineId), HOLD_MS);
    },
    onContextMenu(e: ReactMouseEvent) {
      if (personId) e.preventDefault(); // holding must not open the browser's menu
    },
  });

  return { bind, bindHold, dragging };
}
