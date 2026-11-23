import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MachineIcon, type IconFigure } from '../ui/MachineIcon';
import { recordZones, statsLine } from '../ui/RecordDetail';
import { cropped, gridSize } from '../ui/grid';
import { hexAt } from '../ui/mpsSpin';
import { nickOf } from '../domain/nick';
import { formatPct, skDate } from './xlsx';
import mpsText from '../assets/brand/mps-text.png';
import type { MachineKind, RecordPerson, ShiftRecord } from '../domain/types';

/*
 * The PDF pages, drawn straight onto a canvas (A4 landscape). Drawing the app's own pages through
 * html-to-image took far too long on the tablet (it copies every element's style and the fonts into
 * every page); a canvas takes a fraction of a second. The look follows the app: the same plan, tile
 * colours, machine icons and the MPS logo. The PDF is always light.
 */

/** A4 landscape at 96 dpi (CSS pixels); drawn at SCALE for a sharp print. */
export const PAGE_W = 1123;
export const PAGE_H = 794;
const SCALE = 2;
const PAD_X = 32;
const PAD_TOP = 24;
const PAD_BOTTOM = 22;

/**
 * Machines per table page (the rest continues on the next page). Rows have a fixed height (long lists
 * of people end in "…"), so this many always fit under the header – none is cut off at the bottom.
 */
export const ROWS_PER_PAGE = 22;
const ROW_H = 26;

/** Splits the machine rows into pages of the table. */
export function chunkRows<T>(rows: T[], size = ROWS_PER_PAGE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += size) pages.push(rows.slice(i, i + size));
  return pages.length ? pages : [[]];
}

// the light theme of the app (styles.css)
const C = {
  text: '#14242a',
  muted: '#52646d',
  heading: '#007480',
  line: '#6cb5bc',
  border: '#bfcacf',
  tileBorder: 'rgba(0, 47, 54, 0.18)',
  ext: '#2563eb',
  int: '#dc2626',
  free: '#d5e6e8',
  oosA: '#bfcacf',
  oosB: '#eef4f5',
  red: '#dc2626',
  yellow: '#facc15',
  ink: '#002f36',
  white: '#ffffff',
  hex: ['#f07632', '#008998', '#a7ccd7'],
};
const FONT = "'Roboto Condensed', 'Arial Narrow', sans-serif";
const font = (size: number, weight = 400) => `${weight} ${size}px ${FONT}`;

type Ctx = CanvasRenderingContext2D;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Obrázok sa nenačítal: ${src.slice(0, 60)}`));
    img.src = src;
  });
}

/** Machine icons as images, made once per look (figure, kind, colours). */
const icons = new Map<string, Promise<HTMLImageElement>>();
function icon(figure: IconFigure, kind: MachineKind, ink: string, bg: string): Promise<HTMLImageElement> {
  const key = `${figure}|${kind}|${ink}|${bg}`;
  let p = icons.get(key);
  if (!p) {
    const host = document.createElement('div');
    const root = createRoot(host);
    flushSync(() => root.render(createElement(MachineIcon, { figure, kind })));
    const svg = host.innerHTML
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="232" ')
      .replace(/var\(--icon-bg, #fff\)/g, bg)
      .replace(/currentColor/g, ink);
    root.unmount();
    p = loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    icons.set(key, p);
  }
  return p;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Text cut with "…" to fit the width. */
function fit(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function newPage(): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * SCALE;
  canvas.height = PAGE_H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = C.white;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

/** Title, the other figures, the occupancy box and the MPS logo; returns where the content starts. */
function drawHead(ctx: Ctx, record: ShiftRecord, sub: string | undefined, logo: HTMLImageElement): number {
  const s = record.stats;
  const logoH = 52;
  const textW = (logo.width / logo.height) * logoH;
  const markW = (431 / 638) * logoH;
  const logoW = markW + textW;
  const kpiW = 170;
  const kpiH = 64;
  const right = PAGE_W - PAD_X;
  const top = PAD_TOP;
  // logo: the three hexagons, then the lettering
  const lx = right - logoW;
  const ly = top + (kpiH - logoH) / 2;
  const k = logoH / 638;
  for (let i = 0; i < 3; i++) {
    const pts = hexAt(i, 0).split(' ').map((p) => p.split(',').map(Number));
    ctx.beginPath();
    pts.forEach(([x, y], j) => (j ? ctx.lineTo(lx + x * k, ly + y * k) : ctx.moveTo(lx + x * k, ly + y * k)));
    ctx.closePath();
    ctx.fillStyle = C.hex[i];
    ctx.fill();
  }
  ctx.drawImage(logo, lx + markW, ly, textW, logoH);
  // occupancy box
  const kx = lx - 20 - kpiW;
  roundRect(ctx, kx, top, kpiW, kpiH, 8);
  ctx.fillStyle = C.heading;
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.textAlign = 'center';
  ctx.font = font(12);
  ctx.fillText('OBSADENOSŤ', kx + kpiW / 2, top + 16);
  ctx.font = font(30, 700);
  ctx.fillText(formatPct(s.staffedPct ?? null), kx + kpiW / 2, top + 45);
  ctx.font = font(12);
  ctx.fillText(s.staffed != null ? `${s.staffed} / ${s.total} strojov s ľuďmi` : 'nezaznamenaná', kx + kpiW / 2, top + 59);
  // title and the other figures
  ctx.textAlign = 'left';
  const maxW = kx - 20 - PAD_X;
  ctx.fillStyle = C.heading;
  ctx.font = font(26, 300);
  ctx.fillText(fit(ctx, `Zmena ${record.shiftName} · ${skDate(record.date)}${sub ? ` · ${sub}` : ''}`.toUpperCase(), maxW), PAD_X, top + 28);
  ctx.fillStyle = C.muted;
  ctx.font = font(13);
  // the line wraps once if it is long
  const words = statsLine(record).split(' · ');
  const lines: string[] = [''];
  for (const w of words) {
    const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} · ${w}` : w;
    if (ctx.measureText(next).width > maxW && lines[lines.length - 1]) lines.push(w);
    else lines[lines.length - 1] = next;
  }
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(fit(ctx, l, maxW), PAD_X, top + 48 + i * 17));
  const bottom = top + kpiH + 10;
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD_X, bottom, PAGE_W - 2 * PAD_X, 3);
  return bottom + 13;
}

function figureOf(oos: boolean, people: RecordPerson[]): IconFigure {
  if (oos) return 'oos';
  if (!people.length) return 'none';
  return people[0].role === 'operator' ? 'operator' : 'frezar';
}

async function drawTile(
  ctx: Ctx, l: ShiftRecord['layout'][number], people: RecordPerson[], x: number, y: number, w: number, h: number,
) {
  const oos = l.outOfService;
  const bg = oos ? C.oosB : l.type === 'EXT' ? C.ext : l.type === 'INT' ? C.int : C.free;
  const ink = oos ? C.muted : l.type ? C.white : C.text;
  const r = Math.min(w, h) * 0.1;
  roundRect(ctx, x, y, w, h, r);
  if (oos) {
    // grey stripes like the app
    ctx.save();
    ctx.clip();
    ctx.fillStyle = C.oosB;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.oosA;
    ctx.lineWidth = 4;
    for (let d = -h; d < w; d += 9) {
      ctx.beginPath();
      ctx.moveTo(x + d, y + h);
      ctx.lineTo(x + d + h, y);
      ctx.stroke();
    }
    ctx.restore();
    roundRect(ctx, x, y, w, h, r);
  } else {
    ctx.fillStyle = bg;
    ctx.fill();
  }
  ctx.lineWidth = oos ? 2 : 1.5;
  ctx.strokeStyle = oos ? C.red : C.ink;
  ctx.stroke();
  const unit = Math.min(w, h);
  // icon, nick, person – as on the tile
  const img = await icon(figureOf(oos, people), l.kind ?? 'mill', ink, oos ? C.oosB : bg);
  const iw = unit * 0.5;
  const ih = iw * (116 / 120);
  ctx.drawImage(img, x + (w - iw) / 2, y + h * 0.1, iw, ih);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.font = font(unit * 0.19, 700);
  ctx.fillText(fit(ctx, nickOf({ name: l.name, nick: l.nick }), w - 6), x + w / 2, y + h * 0.1 + ih + unit * 0.2);
  if (people.length) {
    ctx.font = font(unit * 0.15, 400);
    const more = people.length > 1 ? ` +${people.length - 1}` : '';
    ctx.fillText(fit(ctx, `${people[0].name}${more}`, w - 6), x + w / 2, y + h * 0.1 + ih + unit * 0.38);
  }
  if (l.priority && l.type && !oos) {
    // the yellow PRIO tag on the top-left corner
    ctx.font = font(unit * 0.13, 700);
    const tw = ctx.measureText('PRIO').width + unit * 0.14;
    const th = unit * 0.2;
    roundRect(ctx, x - unit * 0.06, y - unit * 0.08, tw, th, th / 2);
    ctx.fillStyle = C.yellow;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.fillText('PRIO', x - unit * 0.06 + tw / 2, y - unit * 0.08 + th * 0.75);
  }
  ctx.textAlign = 'left';
}

/** The plans of all zones, one under the other, cards of one size, each zone centred. */
async function drawPlans(ctx: Ctx, record: ShiftRecord, top: number) {
  const { zones, peopleByMachine } = recordZones(record);
  const gap = 8;
  const zoneGap = 12;
  const named = zones.length > 1;
  const nameH = named ? 22 : 0;
  const plans = zones.map((z) => ({ ...z, items: cropped(z.items), size: gridSize(cropped(z.items)) }));
  const areaW = PAGE_W - 2 * PAD_X;
  const areaH = PAGE_H - PAD_BOTTOM - top;
  const maxCols = Math.max(13, ...plans.map((p) => p.size.cols));
  const rowsTotal = plans.reduce((s, p) => s + p.size.rows, 0);
  const unitW = (areaW - (maxCols - 1) * gap) / maxCols;
  const unitH = (areaH - plans.length * nameH - (plans.length - 1) * zoneGap - plans.reduce((s, p) => s + (p.size.rows - 1) * gap, 0)) / rowsTotal;
  const tile = Math.max(20, Math.min(unitW, unitH));
  let y = top;
  for (const p of plans) {
    if (named) {
      ctx.fillStyle = C.heading;
      ctx.textAlign = 'center';
      ctx.font = font(15, 400);
      ctx.fillText(p.name.toUpperCase(), PAGE_W / 2, y + 15);
      ctx.textAlign = 'left';
      y += nameH;
    }
    const gridW = p.size.cols * tile + (p.size.cols - 1) * gap;
    const x0 = PAD_X + (areaW - gridW) / 2;
    for (const l of p.items) {
      const x = x0 + l.x * (tile + gap);
      const ty = y + l.y * (tile + gap);
      const w = l.w * tile + (l.w - 1) * gap;
      const h = l.h * tile + (l.h - 1) * gap;
      await drawTile(ctx, l, peopleByMachine.get(l.name) ?? [], x, ty, w, h);
    }
    y += p.size.rows * tile + (p.size.rows - 1) * gap + zoneGap;
  }
}

/** One page of the machine table. */
function drawTable(ctx: Ctx, record: ShiftRecord, rows: ShiftRecord['rows'], top: number) {
  const { withZones } = recordZones(record);
  const w = PAGE_W - 2 * PAD_X;
  const cols = withZones
    ? [{ t: 'STROJ', w: 0.24 }, { t: 'ODDELENIE', w: 0.12 }, { t: 'ZAKÁZKA', w: 0.12 }, { t: 'PRIORITA', w: 0.08 }, { t: 'ĽUDIA', w: 0.44 }]
    : [{ t: 'STROJ', w: 0.3 }, { t: 'ZAKÁZKA', w: 0.13 }, { t: 'PRIORITA', w: 0.1 }, { t: 'ĽUDIA', w: 0.47 }];
  const xs: number[] = [];
  cols.reduce((x, c) => (xs.push(x), x + c.w * w), PAD_X);
  ctx.font = font(13);
  ctx.fillStyle = C.muted;
  cols.forEach((c, i) => ctx.fillText(c.t, xs[i] + 8, top + 17));
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD_X, top + ROW_H - 2, w, 2);
  let y = top + ROW_H;
  for (const r of rows) {
    const cells = [
      r.machineName,
      ...(withZones ? [r.hallName ?? ''] : []),
      r.outOfService ? 'mimo prevádzky' : (r.type ?? '–'),
      r.priority ? 'PRIO' : '',
      r.people.map((p) => (p.overtime ? `${p.name} (${p.homeShiftName})` : p.name)).join(', '),
    ];
    ctx.font = font(13);
    cells.forEach((text, i) => {
      if (cols[i].t === 'PRIORITA' && text) {
        // the yellow tag
        ctx.font = font(11, 700);
        const tw = ctx.measureText('PRIO').width + 12;
        roundRect(ctx, xs[i] + 8, y + 5, tw, 16, 8);
        ctx.fillStyle = C.yellow;
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = C.ink;
        ctx.fillText('PRIO', xs[i] + 14, y + 17);
        ctx.font = font(13);
        return;
      }
      ctx.fillStyle = C.text;
      ctx.fillText(fit(ctx, text, cols[i].w * w - 16), xs[i] + 8, y + 17);
    });
    y += ROW_H;
    ctx.fillStyle = C.border;
    ctx.fillRect(PAD_X, y - 1, w, 1);
  }
}

/** All pages of one closed shift: the plan, then the table of machines and people. */
export async function drawRecordPages(record: ShiftRecord): Promise<HTMLCanvasElement[]> {
  await Promise.all([
    document.fonts?.load(font(16, 300)),
    document.fonts?.load(font(16, 400)),
    document.fonts?.load(font(16, 700)),
  ]).catch(() => {});
  const logo = await loadImage(mpsText);
  const pages: HTMLCanvasElement[] = [];
  const first = newPage();
  await drawPlans(first.ctx, record, drawHead(first.ctx, record, undefined, logo));
  pages.push(first.canvas);
  const tables = chunkRows(record.rows);
  for (const [i, rows] of tables.entries()) {
    const p = newPage();
    const top = drawHead(p.ctx, record, tables.length > 1 ? `stroje ${i + 1}/${tables.length}` : 'stroje', logo);
    drawTable(p.ctx, record, rows, top);
    pages.push(p.canvas);
  }
  return pages;
}
