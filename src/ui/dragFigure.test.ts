import { readFileSync } from 'node:fs';
import { CUT_PX, DRAG_POSES, dragFigureSvg } from './dragFigure';

test('every pose is a solid pictogram with a fixed 1.5 px cut-out', () => {
  expect(DRAG_POSES.map((p) => p.pose)).toEqual(['hang', 'swing-left', 'swing-right', 'drop']);
  for (const { pose } of DRAG_POSES) {
    const svg = dragFigureSvg(pose);
    expect(svg).toContain('fill="currentColor"');
    // the cut-out does not scale with the icon: 3 px stroke centred on the edge = 1.5 px outside
    const cuts = svg.match(/stroke-width="(\d+(\.\d+)?)" stroke-linejoin="round" vector-effect="non-scaling-stroke"/g) ?? [];
    expect(cuts.length).toBeGreaterThan(5);
    expect(cuts.every((c) => c.startsWith(`stroke-width="${CUT_PX * 2}"`))).toBe(true);
  }
  expect(CUT_PX).toBe(1.5);
});

test('swinging poses lean the opposite way; only "drop" shows the landing spot', () => {
  expect(dragFigureSvg('swing-left')).toContain('rotate(-13 ');
  expect(dragFigureSvg('swing-right')).toContain('rotate(13 ');
  expect(dragFigureSvg('drop')).toContain('<ellipse');
  expect(dragFigureSvg('hang')).not.toContain('<ellipse');
});

test('the SVG files in public/icons/drag are up to date (node scripts/drag-icons.ts)', () => {
  for (const { pose, label } of DRAG_POSES) {
    // git on Windows may check the files out with CRLF line ends
    const file = readFileSync(`public/icons/drag/operator-${pose}.svg`, 'utf8').replace(/\r\n/g, '\n');
    expect(file).toBe(dragFigureSvg(pose, { title: `Operátor – ${label}` }) + '\n');
  }
});
