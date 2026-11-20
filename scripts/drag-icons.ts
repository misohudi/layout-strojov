// Writes the drag & drop operator icons to public/icons/drag/*.svg.
// Run: node scripts/drag-icons.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { DRAG_POSES, dragFigureSvg } from '../src/ui/dragFigure.ts';

const dir = new URL('../public/icons/drag/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const { pose, label } of DRAG_POSES) {
  writeFileSync(new URL(`operator-${pose}.svg`, dir), dragFigureSvg(pose, { title: `Operátor – ${label}` }) + '\n');
}
console.log(`${DRAG_POSES.length} icons written`);
